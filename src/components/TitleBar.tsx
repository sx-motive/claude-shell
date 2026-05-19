import { History, Minus, Settings } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "./ui/button";

interface TitleBarProps {
  onOpenSessions: () => void;
  onOpenSettings: () => void;
}

export function TitleBar({ onOpenSessions, onOpenSettings }: TitleBarProps) {
  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center px-2 select-none"
    >
      <span className="pl-1 text-xs text-fg-muted/50">Claude Shell</span>
      <div className="flex-1" data-tauri-drag-region />
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-fg-muted/50"
        aria-label="Sessions"
        title="Sessions (Ctrl+Shift+H)"
        onClick={onOpenSessions}
      >
        <History className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-fg-muted/50"
        aria-label="Settings"
        title="Settings (Ctrl+,)"
        onClick={onOpenSettings}
      >
        <Settings className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-fg-muted/50"
        aria-label="Minimize to tray"
        title="Minimize to tray"
        onClick={() => {
          void getCurrentWindow().hide();
        }}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
