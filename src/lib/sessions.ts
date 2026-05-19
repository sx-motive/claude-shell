import { invoke } from "@tauri-apps/api/core";

export interface SessionInfo {
  sessionId: string;
  cwd: string | null;
  title: string | null;
  lastTimestampMs: number | null;
  messageCount: number;
  fileSize: number;
}

export function listSessions(): Promise<SessionInfo[]> {
  return invoke<SessionInfo[]>("list_sessions");
}

export function projectLabel(cwd: string | null): string {
  if (!cwd) return "—";
  const norm = cwd.replace(/\\/g, "/");
  const segments = norm.split("/").filter(Boolean);
  return segments.slice(-2).join("/") || norm;
}

export function relativeTime(ms: number | null): string {
  if (ms == null) return "";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}
