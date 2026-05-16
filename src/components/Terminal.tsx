import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { readText } from "@tauri-apps/plugin-clipboard-manager";
import "@xterm/xterm/css/xterm.css";

import {
  onPtyExit,
  onPtyOutput,
  ptyKill,
  ptyResize,
  ptySpawn,
  ptyWrite,
} from "../lib/pty";
import { terminalThemeFor } from "../design/terminal-theme";
import { useTheme } from "../theme/ThemeProvider";

export interface TerminalProps {
  command: string;
  args?: string[];
  cwd?: string;
  className?: string;
  active?: boolean;
}

const FONT_FAMILY =
  '"JetBrains Mono", "Cascadia Code", "Fira Code", "Consolas", ui-monospace, monospace';

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
}: TerminalProps) {
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
        lineHeight: 1.2,
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
      term.loadAddon(new WebLinksAddon());
      term.loadAddon(new SearchAddon());

      let handle: number | null = null;

      term.attachCustomKeyEventHandler((event) => {
        if (
          event.type === "keydown" &&
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
        return true;
      });

      const dataSub = term.onData((data) => {
        if (handle != null) void ptyWrite(handle, data);
      });

      term.open(container);
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
        dataSub.dispose();
        unlistenOutput?.();
        unlistenExit?.();
        if (handle != null) void ptyKill(handle).catch(() => {});
        fitRef.current = null;
        ptyHandleRef.current = null;
        termRef.current = null;
        term.dispose();
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

      unlistenOutput = await onPtyOutput(handle, (bytes) => term.write(bytes));
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
