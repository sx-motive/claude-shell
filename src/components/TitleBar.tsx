import { History, Minus, Plus, Settings } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "./ui/button";

interface TitleBarProps {
  onNewSession: () => void;
  onResumeSession: () => void;
  onOpenSettings: () => void;
}

export function TitleBar({
  onNewSession,
  onResumeSession,
  onOpenSettings,
}: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center justify-end gap-1 px-2 select-none"
    >
      <Button
        variant="ghost"
        size="icon"
        aria-label="New session"
        title="New session (Ctrl+Shift+N)"
        onClick={onNewSession}
      >
        <Plus className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Resume session"
        title="Resume session (Ctrl+Shift+R)"
        onClick={onResumeSession}
      >
        <History className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Settings"
        title="Settings (Ctrl+,)"
        onClick={onOpenSettings}
      >
        <Settings className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Minimize to tray"
        title="Minimize to tray"
        onClick={() => {
          void getCurrentWindow().hide();
        }}
      >
        <Minus className="h-4 w-4" />
      </Button>
    </div>
  );
}
