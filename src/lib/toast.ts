import { invoke } from "@tauri-apps/api/core";

export interface ToastInput {
  title?: string;
  body: string;
  durationMs?: number;
  tabId?: string;
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `toast-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function pushToast(input: ToastInput): Promise<void> {
  await invoke("push_overlay_toast", {
    payload: {
      id: makeId(),
      title: input.title,
      body: input.body,
      tabId: input.tabId,
      durationMs: input.durationMs,
    },
  }).catch(() => {
    // overlay unavailable; swallow silently
  });
}
