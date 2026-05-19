import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { readNotifyOnIdle } from "../settings/notifyOnIdle";

export interface IdleNotifierOptions {
  idleMs?: number;
  startupGraceMs?: number;
  minBytesForNotify?: number;
  title?: string;
  bodyFor?: () => string;
}

export interface IdleNotifier {
  noteOutput: (size: number) => void;
  dispose: () => void;
}

let permissionPromise: Promise<boolean> | null = null;
function ensurePermission(): Promise<boolean> {
  if (!permissionPromise) {
    permissionPromise = (async () => {
      try {
        if (await isPermissionGranted()) return true;
        const result = await requestPermission();
        return result === "granted";
      } catch {
        return false;
      }
    })();
  }
  return permissionPromise;
}

export function createIdleNotifier(
  opts: IdleNotifierOptions = {},
): IdleNotifier {
  const idleMs = opts.idleMs ?? 900;
  const startupGraceMs = opts.startupGraceMs ?? 3000;
  const minBytes = opts.minBytesForNotify ?? 80;
  const title = opts.title ?? "Claude Shell";
  const bodyFor = opts.bodyFor ?? (() => "Session finished");

  const createdAt = Date.now();
  let bytesSinceQuiet = 0;
  let timer: number | null = null;
  let disposed = false;

  const fire = async () => {
    timer = null;
    if (disposed) return;
    if (Date.now() - createdAt < startupGraceMs) {
      bytesSinceQuiet = 0;
      return;
    }
    const bytes = bytesSinceQuiet;
    bytesSinceQuiet = 0;
    if (bytes < minBytes) return;
    if (!readNotifyOnIdle()) return;

    let focused = true;
    try {
      focused = await getCurrentWindow().isFocused();
    } catch {
      focused = true;
    }
    if (focused) return;

    if (!(await ensurePermission())) return;
    try {
      sendNotification({ title, body: bodyFor() });
    } catch {
      // ignore
    }
  };

  return {
    noteOutput: (size: number) => {
      if (disposed) return;
      bytesSinceQuiet += size;
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(fire, idleMs);
    },
    dispose: () => {
      disposed = true;
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
    },
  };
}
