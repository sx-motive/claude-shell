import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { WebglAddon } from "@xterm/addon-webgl";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { openUrl } from "@tauri-apps/plugin-opener";
import "@xterm/xterm/css/xterm.css";

import {
  onPtyExit,
  onPtyOutput,
  ptyKill,
  ptyResize,
  ptySpawn,
  ptyWrite,
} from "../lib/pty";
import { createIdleNotifier } from "../lib/idleNotifier";
import { terminalThemeFor } from "../design/terminal-theme";
import { useTheme } from "../theme/ThemeProvider";

export interface TerminalProps {
  command: string;
  args?: string[];
  cwd?: string;
  className?: string;
  active?: boolean;
  onClaudeReady?: () => void;
}

const FONT_FAMILY =
  '"Geist Mono Variable", "JetBrains Mono", "Cascadia Code", "Fira Code", "Consolas", ui-monospace, monospace';

const AUTO_REPLY_PATTERNS: RegExp[] = [
  /^\x1b\[\d+;\d+R$/,
  /^\x1b\[\?[\d;]+\$y$/,
  /^\x1b\[\?[\d;]+c$/,
  /^\x1b\[>[\d;]+c$/,
];

function isLikelyUserInput(data: string): boolean {
  if (data === "\x1b[I" || data === "\x1b[O") return false;
  for (const re of AUTO_REPLY_PATTERNS) {
    if (re.test(data)) return false;
  }
  return true;
}

async function smartPaste(term: XTerm, handle: number): Promise<void> {
  let text: string | null = null;
  try {
    text = await readText();
  } catch {
    text = null;
  }
  if (text) {
    term.paste(text);
    return;
  }
  await ptyWrite(handle, "\x1bv").catch(() => {});
}

function waitForLayout(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      resolve();
      return;
    }
    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        ro.disconnect();
        resolve();
      }
    });
    ro.observe(el);
  });
}

export function Terminal({
  command,
  args,
  cwd,
  className,
  active = true,
  onClaudeReady,
}: TerminalProps) {
  const onClaudeReadyRef = useRef(onClaudeReady);
  onClaudeReadyRef.current = onClaudeReady;
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyHandleRef = useRef<number | null>(null);
  const argsRef = useRef(args);
  const cwdRef = useRef(cwd);
  argsRef.current = args;
  cwdRef.current = cwd;

  const { resolved } = useTheme();
  const initialThemeRef = useRef(resolved);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      await waitForLayout(container);
      if (cancelled) return;

      const term = new XTerm({
        fontFamily: FONT_FAMILY,
        fontSize: 13,
        lineHeight: 16 / 13,
        letterSpacing: 0,
        cursorBlink: true,
        cursorStyle: "bar",
        scrollback: 10_000,
        allowProposedApi: true,
        macOptionIsMeta: true,
        theme: terminalThemeFor(initialThemeRef.current),
      });
      termRef.current = term;

      const fit = new FitAddon();
      fitRef.current = fit;
      term.loadAddon(fit);
      term.loadAddon(
        new WebLinksAddon((event, uri) => {
          if (!event.ctrlKey && !event.metaKey) return;
          void openUrl(uri).catch(() => {});
        }),
      );
      term.loadAddon(new SearchAddon());

      term.open(container);

      try {
        const webgl = new WebglAddon();
        webgl.onContextLoss(() => {
          try {
            webgl.dispose();
          } catch {
            // ignore
          }
        });
        term.loadAddon(webgl);
      } catch {
        // GPU unavailable; fall back to default renderer
      }

      let handle: number | null = null;

      term.attachCustomKeyEventHandler((event) => {
        if (event.type !== "keydown") return true;

        if (
          event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          !event.metaKey &&
          event.key.toLowerCase() === "v"
        ) {
          event.preventDefault();
          if (handle != null) void smartPaste(term, handle);
          return false;
        }

        if (event.key === "Enter" && (event.shiftKey || event.ctrlKey)) {
          event.preventDefault();
          if (handle != null) void ptyWrite(handle, "\x1b\r");
          return false;
        }

        return true;
      });

      const notifier = createIdleNotifier({
        onReady: () => onClaudeReadyRef.current?.(),
      });

      const dataSub = term.onData((data) => {
        if (isLikelyUserInput(data)) notifier.noteInput();
        if (handle != null) void ptyWrite(handle, data);
      });

      try {
        fit.fit();
      } catch {
        // renderer not ready; resize observer retries
      }
      term.focus();

      const onContainerClick = () => term.focus();
      container.addEventListener("click", onContainerClick);

      let lastSentCols = term.cols;
      let lastSentRows = term.rows;
      let pendingResize: number | null = null;
      const flushResize = () => {
        pendingResize = null;
        if (handle == null) return;
        if (term.cols === lastSentCols && term.rows === lastSentRows) return;
        lastSentCols = term.cols;
        lastSentRows = term.rows;
        void ptyResize(handle, term.cols, term.rows);
      };
      const resizeObserver = new ResizeObserver(() => {
        if (container.clientWidth === 0 || container.clientHeight === 0) return;
        try {
          fit.fit();
        } catch {
          return;
        }
        if (pendingResize != null) window.clearTimeout(pendingResize);
        pendingResize = window.setTimeout(flushResize, 180);
      });
      resizeObserver.observe(container);

      let unlistenOutput: UnlistenFn | null = null;
      let unlistenExit: UnlistenFn | null = null;

      cleanup = () => {
        if (pendingResize != null) window.clearTimeout(pendingResize);
        resizeObserver.disconnect();
        container.removeEventListener("click", onContainerClick);
        try {
          dataSub.dispose();
        } catch {
          // ignore
        }
        unlistenOutput?.();
        unlistenExit?.();
        if (handle != null) void ptyKill(handle).catch(() => {});
        notifier.dispose();
        fitRef.current = null;
        ptyHandleRef.current = null;
        termRef.current = null;
        try {
          term.dispose();
        } catch (err) {
          console.warn("term.dispose threw:", err);
        }
      };

      try {
        handle = await ptySpawn({
          command,
          args: argsRef.current ?? [],
          cwd: cwdRef.current,
          cols: term.cols,
          rows: term.rows,
        });
      } catch (err) {
        term.write(
          `\r\n\x1b[31m[pty spawn failed: ${String(err)}]\x1b[0m\r\n`,
        );
        return;
      }

      if (cancelled) {
        await ptyKill(handle).catch(() => {});
        return;
      }

      ptyHandleRef.current = handle;

      unlistenOutput = await onPtyOutput(handle, (bytes) => {
        term.write(bytes);
        notifier.noteOutput(bytes.length);
      });
      unlistenExit = await onPtyExit(handle, ({ code }) => {
        term.write(
          `\r\n\x1b[90m[process exited with code ${code ?? "unknown"}]\x1b[0m\r\n`,
        );
      });

      term.focus();
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [command]);

  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    term.options.theme = terminalThemeFor(resolved);
  }, [resolved]);

  useEffect(() => {
    if (!active) return;
    const raf = requestAnimationFrame(() => {
      const term = termRef.current;
      const fit = fitRef.current;
      if (!term || !fit) return;
      try {
        fit.fit();
      } catch {
        return;
      }
      const handle = ptyHandleRef.current;
      if (handle != null) void ptyResize(handle, term.cols, term.rows);
      term.refresh(0, term.rows - 1);
      term.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return <div ref={containerRef} className={className} />;
}
