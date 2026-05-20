import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

interface ToastPayload {
  id: string;
  title?: string;
  body: string;
  tabId?: string;
  durationMs?: number;
}

interface VisibleToast extends ToastPayload {
  exiting: boolean;
}

const DEFAULT_DURATION_MS = 5000;
const EXIT_ANIM_MS = 160;
const HIDE_DELAY_MS = 220;
const OVERLAY_WIDTH = 360;

type AudioContextCtor = typeof AudioContext;

let audioCtx: AudioContext | null = null;
function getAudioCtx(): AudioContext | null {
  if (audioCtx) return audioCtx;
  const Ctor: AudioContextCtor | undefined =
    typeof window !== "undefined"
      ? window.AudioContext ??
        (window as unknown as { webkitAudioContext?: AudioContextCtor })
          .webkitAudioContext
      : undefined;
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

function playChime(): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const notes: Array<{ freq: number; start: number; dur: number }> = [
    { freq: 880, start: 0, dur: 0.18 },
    { freq: 1318.5, start: 0.09, dur: 0.22 },
  ];
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = note.freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const t0 = now + note.start;
    const t1 = t0 + note.dur;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.04, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t1);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }
}

export function OverlayApp() {
  const [toasts, setToasts] = useState<VisibleToast[]>([]);
  const timersRef = useRef(new Map<string, number>());
  const hideTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    let cancelled = false;

    const beginExit = (id: string) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
      );
      const removeAt = window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timersRef.current.delete(`${id}:remove`);
      }, EXIT_ANIM_MS);
      timersRef.current.set(`${id}:remove`, removeAt);
    };

    listen<ToastPayload>("toast://new", (event) => {
      const toast = event.payload;
      playChime();
      setToasts((prev) => [...prev, { ...toast, exiting: false }]);
      const ms = toast.durationMs ?? DEFAULT_DURATION_MS;
      const exitAt = window.setTimeout(() => {
        timersRef.current.delete(`${toast.id}:exit`);
        beginExit(toast.id);
      }, ms);
      timersRef.current.set(`${toast.id}:exit`, exitAt);
    }).then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      unlisten = fn;
      void invoke("overlay_ready").catch(() => {});
    });

    return () => {
      cancelled = true;
      unlisten?.();
      for (const id of timersRef.current.values()) window.clearTimeout(id);
      timersRef.current.clear();
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (toasts.length > 0) {
      if (hideTimerRef.current != null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      return;
    }
    if (hideTimerRef.current != null) return;
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      void invoke("hide_overlay_window").catch(() => {});
    }, HIDE_DELAY_MS);
  }, [toasts.length]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => {
      const height = Math.max(1, Math.ceil(el.scrollHeight));
      void invoke("resize_overlay_window", {
        width: OVERLAY_WIDTH,
        height,
      }).catch(() => {});
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const dismiss = (id: string) => {
    const exitTimer = timersRef.current.get(`${id}:exit`);
    if (exitTimer != null) {
      window.clearTimeout(exitTimer);
      timersRef.current.delete(`${id}:exit`);
    }
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)),
    );
    const removeAt = window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timersRef.current.delete(`${id}:remove`);
    }, EXIT_ANIM_MS);
    timersRef.current.set(`${id}:remove`, removeAt);
  };

  const handleClick = (toast: ToastPayload) => {
    if (toast.tabId) {
      void invoke("overlay_activate_tab", { tabId: toast.tabId }).catch(
        () => {},
      );
    }
    dismiss(toast.id);
  };

  return (
    <div ref={containerRef} className="flex w-full flex-col gap-2 p-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          onClick={() => handleClick(t)}
          className={`group flex items-start gap-3 border border-border bg-bg-elevated px-3 py-2.5 text-xs text-fg shadow-lg shadow-black/30 ${
            t.tabId ? "cursor-pointer" : "cursor-default"
          } ${t.exiting ? "toast-exit" : "toast-enter"}`}
        >
          <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-accent" />
          <div className="grid min-w-0 flex-1 gap-0.5">
            {t.title && (
              <span className="block truncate text-[10px] font-medium tracking-wide text-fg-muted uppercase">
                {t.title}
              </span>
            )}
            <span className="block break-words text-fg">{t.body}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={(e) => {
              e.stopPropagation();
              dismiss(t.id);
            }}
            className="mt-0.5 text-fg-muted opacity-60 hover:opacity-100"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
