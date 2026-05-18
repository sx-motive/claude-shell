import { useCallback, useEffect, useState } from "react";

export const SKIP_PERMISSIONS_KEY = "claude-shell:skip-permissions";
export const SKIP_PERMISSIONS_DEFAULT = true;

type Listener = (value: boolean) => void;
const listeners = new Set<Listener>();
let current: boolean | null = null;

export function resetSkipPermissionsCache(): void {
  current = null;
}

export function readSkipPermissions(): boolean {
  if (current !== null) return current;
  if (typeof window === "undefined") return SKIP_PERMISSIONS_DEFAULT;
  const raw = window.localStorage.getItem(SKIP_PERMISSIONS_KEY);
  current = raw === null ? SKIP_PERMISSIONS_DEFAULT : raw === "1";
  return current;
}

export function writeSkipPermissions(value: boolean): void {
  current = value;
  window.localStorage.setItem(SKIP_PERMISSIONS_KEY, value ? "1" : "0");
  listeners.forEach((fn) => fn(value));
}

export function useSkipPermissions(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(readSkipPermissions);

  useEffect(() => {
    const listener: Listener = (next) => setValue(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const set = useCallback((next: boolean) => {
    writeSkipPermissions(next);
  }, []);

  return [value, set];
}
