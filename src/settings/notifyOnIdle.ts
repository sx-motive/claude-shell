import { useCallback, useEffect, useState } from "react";

export const NOTIFY_ON_IDLE_KEY = "claude-shell:notify-on-idle";
export const NOTIFY_ON_IDLE_DEFAULT = true;

type Listener = (value: boolean) => void;
const listeners = new Set<Listener>();
let current: boolean | null = null;

export function resetNotifyOnIdleCache(): void {
  current = null;
}

export function readNotifyOnIdle(): boolean {
  if (current !== null) return current;
  if (typeof window === "undefined") return NOTIFY_ON_IDLE_DEFAULT;
  const raw = window.localStorage.getItem(NOTIFY_ON_IDLE_KEY);
  current = raw === null ? NOTIFY_ON_IDLE_DEFAULT : raw === "1";
  return current;
}

export function writeNotifyOnIdle(value: boolean): void {
  current = value;
  window.localStorage.setItem(NOTIFY_ON_IDLE_KEY, value ? "1" : "0");
  listeners.forEach((fn) => fn(value));
}

export function useNotifyOnIdle(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(readNotifyOnIdle);

  useEffect(() => {
    const listener: Listener = (next) => setValue(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const set = useCallback((next: boolean) => {
    writeNotifyOnIdle(next);
  }, []);

  return [value, set];
}
