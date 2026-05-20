import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { pushToast } from "./toast";

let started = false;

export async function runUpdateCheck(): Promise<void> {
  if (started) return;
  started = true;

  try {
    const update = await check();
    if (!update) return;

    await pushToast({
      title: "Доступно обновление",
      body: `v${update.version} — будет предложена установка`,
      durationMs: 6000,
    });

    const accept = window.confirm(
      `Доступна Claude Shell v${update.version}.\n\nУстановить сейчас? Приложение перезапустится.`,
    );
    if (!accept) return;

    await update.downloadAndInstall();
    await relaunch();
  } catch (err) {
    console.warn("[updater] check failed", err);
  }
}
