import { MouseEvent } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "../lib/utils";

export interface TabDescriptor {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: TabDescriptor[];
  activeTabId: string | null;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onNewSession: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onActivate,
  onClose,
  onNewSession,
}: TabBarProps) {
  if (tabs.length === 0) return null;

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>, id: string) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose(id);
    }
  };

  return (
    <div className="flex h-7 shrink-0 items-stretch gap-px overflow-x-auto border-t border-border bg-bg px-4 text-xs">
      {tabs.map((tab) => {
        const active = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onActivate(tab.id)}
            onMouseDown={(e) => handleMouseDown(e, tab.id)}
            className={cn(
              "group relative flex shrink-0 cursor-default items-center transition-colors",
              active
                ? "bg-bg-elevated text-fg shadow-[inset_0_-2px_0_0_var(--color-accent)]"
                : "text-fg-muted/50 hover:bg-bg-elevated/60 hover:text-fg",
            )}
          >
            <span className="max-w-44 truncate px-4">{tab.label}</span>
            <button
              type="button"
              aria-label="Close tab"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation();
                onClose(tab.id);
              }}
              className="absolute top-1/2 right-1 hidden h-5 w-5 -translate-y-1/2 items-center justify-center bg-bg-elevated text-fg-muted group-hover:inline-flex hover:bg-border hover:text-fg"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        aria-label="New session"
        title="New session (Ctrl+Shift+N)"
        onClick={onNewSession}
        className="ml-1 flex h-full w-7 shrink-0 items-center justify-center text-fg-muted/60 hover:bg-bg-elevated hover:text-fg"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
