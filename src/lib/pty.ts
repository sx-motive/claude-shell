import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface PtySpawnArgs {
  command: string;
  args?: string[];
  cwd?: string;
  cols: number;
  rows: number;
  env?: Record<string, string>;
}

export interface PtyExitPayload {
  handle: number;
  code: number | null;
}

export function ptySpawn(args: PtySpawnArgs): Promise<number> {
  return invoke<number>("pty_spawn", { args });
}

export function ptyWrite(handle: number, data: string): Promise<void> {
  return invoke("pty_write", { handle, data });
}

export function ptyResize(
  handle: number,
  cols: number,
  rows: number,
): Promise<void> {
  return invoke("pty_resize", { handle, cols, rows });
}

export function ptyKill(handle: number): Promise<void> {
  return invoke("pty_kill", { handle });
}

export function onPtyOutput(
  handle: number,
  fn: (bytes: Uint8Array) => void,
): Promise<UnlistenFn> {
  return listen<string>(`pty:output:${handle}`, (event) => {
    fn(base64ToBytes(event.payload));
  });
}

export function onPtyExit(
  handle: number,
  fn: (payload: PtyExitPayload) => void,
): Promise<UnlistenFn> {
  return listen<PtyExitPayload>(`pty:exit:${handle}`, (event) => {
    fn(event.payload);
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
