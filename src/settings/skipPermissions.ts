import { useCallback, useEffect, useState } from "react";

const KEY = "claude-shell:skip-permissions";
const DEFAULT = true;

type Listener = (value: boolean) => void;
const listeners = new Set<Listener>();
let current: boolean | null = null;

function read(): boolean {
  if (current !== null) return current;
  if (typeof window === "undefined") return DEFAULT;
  const raw = window.localStorage.getItem(KEY);
  current = raw === null ? DEFAULT : raw === "1";
  return current;
}

function write(value: boolean): void {
  current = value;
  window.localStorage.setItem(KEY, value ? "1" : "0");
  listeners.forEach((fn) => fn(value));
}

export function useSkipPermissions(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(read);

  useEffect(() => {
    const listener: Listener = (next) => setValue(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const set = useCallback((next: boolean) => {
    write(next);
  }, []);

  return [value, set];
}
