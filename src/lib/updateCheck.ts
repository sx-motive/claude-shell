import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { pushToast } from "./toast";

export interface UpdateAvailable {
  version: string;
  notes?: string;
  install: (onProgress?: (downloaded: number, total: number | null) => void) => Promise<void>;
}

let started = false;

export async function checkForUpdate(): Promise<UpdateAvailable | null> {
  if (started) return null;
  started = true;

  try {
    const update = await check();
    if (!update) return null;
    return wrap(update);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[updater] check failed", err);
    void pushToast({
      title: "Не удалось проверить обновления",
      body: message,
      durationMs: 6000,
    });
    return null;
  }
}

function wrap(update: Update): UpdateAvailable {
  return {
    version: update.version,
    notes: update.body || undefined,
    install: async (onProgress) => {
      let downloaded = 0;
      let total: number | null = null;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? null;
          onProgress?.(0, total);
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          onProgress?.(downloaded, total);
        } else if (event.event === "Finished") {
          onProgress?.(total ?? downloaded, total);
        }
      });
      await relaunch();
    },
  };
}
