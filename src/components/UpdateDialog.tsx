import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import type { UpdateAvailable } from "../lib/updateCheck";

type Phase =
  | { kind: "prompt" }
  | { kind: "installing"; downloaded: number; total: number | null }
  | { kind: "error"; message: string };

interface UpdateDialogProps {
  update: UpdateAvailable | null;
  onDismiss: () => void;
}

export function UpdateDialog({ update, onDismiss }: UpdateDialogProps) {
  const [phase, setPhase] = useState<Phase>({ kind: "prompt" });

  if (!update) return null;

  const installing = phase.kind === "installing";

  const handleInstall = async () => {
    setPhase({ kind: "installing", downloaded: 0, total: null });
    try {
      await update.install((downloaded, total) => {
        setPhase({ kind: "installing", downloaded, total });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPhase({ kind: "error", message });
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !installing) onDismiss();
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Доступно обновление</DialogTitle>
          <DialogDescription>
            Claude Shell v{update.version}. После установки приложение
            перезапустится.
          </DialogDescription>
        </DialogHeader>

        {update.notes && phase.kind === "prompt" && (
          <pre className="max-h-40 overflow-auto rounded-md border border-border bg-bg p-3 font-mono text-xs whitespace-pre-wrap text-fg-muted">
            {update.notes}
          </pre>
        )}

        {phase.kind === "installing" && <ProgressBar phase={phase} />}

        {phase.kind === "error" && (
          <p className="text-sm text-red-400">{phase.message}</p>
        )}

        <div className="mt-2 flex justify-end gap-2">
          {phase.kind === "prompt" && (
            <>
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Позже
              </Button>
              <Button size="sm" onClick={handleInstall}>
                Установить
              </Button>
            </>
          )}
          {phase.kind === "error" && (
            <Button variant="outline" size="sm" onClick={onDismiss}>
              Закрыть
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProgressBar({
  phase,
}: {
  phase: { downloaded: number; total: number | null };
}) {
  const { downloaded, total } = phase;
  const pct = total ? Math.min(100, (downloaded / total) * 100) : null;
  const label = total
    ? `${formatMB(downloaded)} / ${formatMB(total)} MB`
    : `${formatMB(downloaded)} MB`;

  return (
    <div className="grid gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
        <div
          className="h-full bg-accent transition-[width]"
          style={{ width: pct == null ? "30%" : `${pct}%` }}
        />
      </div>
      <span className="text-xs text-fg-muted">
        {pct == null ? "Загрузка…" : `Загрузка: ${label}`}
      </span>
    </div>
  );
}

function formatMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}
