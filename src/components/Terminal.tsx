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

export interface TerminalProps {
  command: string;
  args?: string[];
  cwd?: string;
  className?: string;
}

const FONT_FAMILY =
  '"JetBrains Mono", "Cascadia Code", "Fira Code", "Consolas", ui-monospace, monospace';

const THEME = {
  background: "#0a0a0b",
  foreground: "#e4e4e7",
  cursor: "#d48256",
  cursorAccent: "#0a0a0b",
  selectionBackground: "#3f3f46",
  black: "#18181b",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#e4e4e7",
  brightBlack: "#52525b",
  brightRed: "#fca5a5",
  brightGreen: "#86efac",
  brightYellow: "#fde68a",
  brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9",
  brightWhite: "#fafafa",
};

async function smartPaste(term: XTerm, handle: number): Promise<void> {
  let text: string | null = null;
  try {
    text = await readText();
  } catch {
    // clipboard read failed; fall through to image-paste path
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

export function Terminal({ command, args, cwd, className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const argsRef = useRef(args);
  const cwdRef = useRef(cwd);
  argsRef.current = args;
  cwdRef.current = cwd;

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
        theme: THEME,
      });

      const fit = new FitAddon();
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
        // renderer might not be ready yet; resize observer will retry
      }
      term.focus();

      const onContainerClick = () => term.focus();
      container.addEventListener("click", onContainerClick);

      let resizeRaf: number | null = null;
      const resizeObserver = new ResizeObserver(() => {
        if (resizeRaf != null) cancelAnimationFrame(resizeRaf);
        resizeRaf = requestAnimationFrame(() => {
          try {
            fit.fit();
            if (handle != null) {
              void ptyResize(handle, term.cols, term.rows);
            }
          } catch {
            // ignore transient sizing errors
          }
        });
      });
      resizeObserver.observe(container);

      let unlistenOutput: UnlistenFn | null = null;
      let unlistenExit: UnlistenFn | null = null;

      cleanup = () => {
        if (resizeRaf != null) cancelAnimationFrame(resizeRaf);
        resizeObserver.disconnect();
        container.removeEventListener("click", onContainerClick);
        dataSub.dispose();
        unlistenOutput?.();
        unlistenExit?.();
        if (handle != null) void ptyKill(handle).catch(() => {});
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

  return <div ref={containerRef} className={className} />;
}
