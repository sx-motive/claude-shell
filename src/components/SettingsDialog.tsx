import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Segmented, SegmentedItem } from "./ui/segmented";
import { Switch } from "./ui/switch";
import { useTheme, type ThemePreference } from "../theme/ThemeProvider";
import { useSkipPermissions } from "../settings/skipPermissions";
import { useClaudePath } from "../settings/claudePath";
import { useNotifyOnIdle } from "../settings/notifyOnIdle";
import { detectClaudePath, validateClaudePath } from "../lib/claudeBin";

type BinaryStatus =
  | { kind: "idle" }
  | { kind: "auto"; path: string | null }
  | { kind: "override"; resolved: string }
  | { kind: "error"; message: string };

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const themeOptions: Array<{
  value: ThemePreference;
  label: string;
  icon: typeof Sun;
}> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { preference, setPreference } = useTheme();
  const [skipPermissions, setSkipPermissions] = useSkipPermissions();
  const [notifyOnIdle, setNotifyOnIdle] = useNotifyOnIdle();
  const [claudePath, setClaudePath] = useClaudePath();
  const [pathDraft, setPathDraft] = useState(claudePath);
  const [status, setStatus] = useState<BinaryStatus>({ kind: "idle" });

  useEffect(() => {
    if (!open) return;
    setPathDraft(claudePath);
  }, [open, claudePath]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const draft = pathDraft.trim();
    if (draft === "") {
      void detectClaudePath().then((path) => {
        if (cancelled) return;
        setStatus({ kind: "auto", path });
      });
    } else {
      void validateClaudePath(draft).then(
        (resolved) => {
          if (cancelled) return;
          setStatus({ kind: "override", resolved });
        },
        (err: unknown) => {
          if (cancelled) return;
          setStatus({ kind: "error", message: String(err) });
        },
      );
    }
    return () => {
      cancelled = true;
    };
  }, [open, pathDraft]);

  const commitPath = () => {
    if (pathDraft !== claudePath) setClaudePath(pathDraft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Customize how claude-shell looks and runs.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <span className="text-xs font-medium text-fg-muted uppercase tracking-wide">
            Theme
          </span>
          <Segmented
            value={preference}
            onValueChange={(v) => setPreference(v as ThemePreference)}
            aria-label="Theme"
          >
            {themeOptions.map(({ value, label, icon: Icon }) => (
              <SegmentedItem key={value} value={value} aria-label={label}>
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
              </SegmentedItem>
            ))}
          </Segmented>
        </div>

        <div className="grid gap-3">
          <span className="text-xs font-medium text-fg-muted uppercase tracking-wide">
            Claude
          </span>
          <label
            htmlFor="skip-permissions"
            className="flex cursor-pointer items-start justify-between gap-4"
          >
            <span className="grid gap-1">
              <span className="text-sm text-fg">Skip permission prompts</span>
              <span className="text-xs text-fg-muted">
                Launches claude with{" "}
                <code className="font-mono text-[11px]">
                  --dangerously-skip-permissions
                </code>
                . Claude won't ask before each tool call. Takes effect on the
                next session.
              </span>
            </span>
            <Switch
              id="skip-permissions"
              checked={skipPermissions}
              onCheckedChange={setSkipPermissions}
            />
          </label>

          <label
            htmlFor="notify-on-idle"
            className="flex cursor-pointer items-start justify-between gap-4"
          >
            <span className="grid gap-1">
              <span className="text-sm text-fg">Notify when Claude finishes</span>
              <span className="text-xs text-fg-muted">
                Pops a system notification when output goes quiet and the window
                isn't focused.
              </span>
            </span>
            <Switch
              id="notify-on-idle"
              checked={notifyOnIdle}
              onCheckedChange={setNotifyOnIdle}
            />
          </label>

          <label htmlFor="claude-path" className="grid gap-1">
            <span className="text-sm text-fg">Binary path</span>
            <input
              id="claude-path"
              type="text"
              spellCheck={false}
              autoComplete="off"
              value={pathDraft}
              placeholder={
                status.kind === "auto" && status.path
                  ? status.path
                  : "Auto-detect on PATH"
              }
              onChange={(e) => setPathDraft(e.target.value)}
              onBlur={commitPath}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitPath();
                }
              }}
              className="rounded-md border border-border bg-bg-elevated px-2 py-1.5 font-mono text-xs text-fg outline-none focus:border-fg-muted"
            />
            <span className="text-xs text-fg-muted">
              {renderStatusHint(status)} Takes effect on the next session.
            </span>
          </label>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderStatusHint(status: BinaryStatus): string {
  switch (status.kind) {
    case "idle":
      return "Checking…";
    case "auto":
      return status.path
        ? `Auto-detected: ${status.path}.`
        : "claude not found on PATH. Enter a full path.";
    case "override":
      return `Using override: ${status.resolved}.`;
    case "error":
      return `Invalid path: ${status.message}`;
  }
}
