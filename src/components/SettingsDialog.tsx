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
        </div>
      </DialogContent>
    </Dialog>
  );
}
