import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { pushToast } from "./toast";

let started = false;

export async function runUpdateCheck(): Promise<void> {
  if (started) return;
  started = true;

  try {
    console.info("[updater] check starting");
    const update = await check();
    console.info("[updater] check result", update);
    if (!update) {
      await pushToast({
        title: "Updater",
        body: "Версия актуальная (нет апдейта)",
        durationMs: 4000,
      });
      return;
    }

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
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[updater] check failed", err);
    window.alert(`Updater error:\n${message}`);
  }
}
