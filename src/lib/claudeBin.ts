import { invoke } from "@tauri-apps/api/core";

export function detectClaudePath(): Promise<string | null> {
  return invoke<string | null>("detect_claude_path");
}

export function validateClaudePath(path: string): Promise<string> {
  return invoke<string>("validate_claude_path", { path });
}
