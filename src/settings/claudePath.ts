import { useCallback, useEffect, useState } from "react";

export const CLAUDE_PATH_KEY = "claude-shell:claude-path";

type Listener = (value: string) => void;
const listeners = new Set<Listener>();
let current: string | null = null;

export function resetClaudePathCache(): void {
  current = null;
}

export function readClaudePath(): string {
  if (current !== null) return current;
  if (typeof window === "undefined") return "";
  current = window.localStorage.getItem(CLAUDE_PATH_KEY) ?? "";
  return current;
}

export function writeClaudePath(value: string): void {
  const normalized = value.trim();
  current = normalized;
  if (normalized) {
    window.localStorage.setItem(CLAUDE_PATH_KEY, normalized);
  } else {
    window.localStorage.removeItem(CLAUDE_PATH_KEY);
  }
  listeners.forEach((fn) => fn(normalized));
}

export function useClaudePath(): [string, (value: string) => void] {
  const [value, setValue] = useState(readClaudePath);

  useEffect(() => {
    const listener: Listener = (next) => setValue(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const set = useCallback((next: string) => {
    writeClaudePath(next);
  }, []);

  return [value, set];
}

export function resolveCommand(override: string): string {
  const trimmed = override.trim();
  return trimmed.length > 0 ? trimmed : "claude";
}
