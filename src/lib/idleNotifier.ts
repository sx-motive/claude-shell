export interface IdleNotifierOptions {
  idleMs?: number;
  startupGraceMs?: number;
  minBytesForNotify?: number;
  onReady?: () => void;
}

export interface IdleNotifier {
  noteOutput: (size: number) => void;
  noteInput: () => void;
  dispose: () => void;
}

export function createIdleNotifier(
  opts: IdleNotifierOptions = {},
): IdleNotifier {
  const idleMs = opts.idleMs ?? 900;
  const startupGraceMs = opts.startupGraceMs ?? 3000;
  const minBytes = opts.minBytesForNotify ?? 80;
  const onReady = opts.onReady;

  const createdAt = Date.now();
  let bytesSinceQuiet = 0;
  let timer: number | null = null;
  let disposed = false;
  let armed = false;

  const fire = () => {
    timer = null;
    if (disposed) return;
    if (Date.now() - createdAt < startupGraceMs) {
      bytesSinceQuiet = 0;
      return;
    }
    const bytes = bytesSinceQuiet;
    bytesSinceQuiet = 0;
    if (!armed) return;
    if (bytes < minBytes) return;
    armed = false;
    try {
      onReady?.();
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
    noteInput: () => {
      if (disposed) return;
      armed = true;
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
