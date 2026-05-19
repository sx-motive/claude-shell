import {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { Plus, X } from "lucide-react";
import { cn } from "../lib/utils";

export interface TabDescriptor {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: TabDescriptor[];
  activeTabId: string | null;
  unreadIds?: ReadonlySet<string>;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  onRename?: (id: string, label: string) => void;
  onNewSession: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  unreadIds,
  onActivate,
  onClose,
  onRename,
  onNewSession,
}: TabBarProps) {
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>, id: string) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose(id);
    }
  };

  const stripRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaX !== 0) return;
      if (e.deltaY === 0) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId == null) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.select();
  }, [editingId]);

  const startRename = (tab: TabDescriptor) => {
    if (!onRename) return;
    setEditingId(tab.id);
    setDraft(tab.label);
  };

  const commitRename = () => {
    if (editingId == null) return;
    onRename?.(editingId, draft);
    setEditingId(null);
    setDraft("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraft("");
  };

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancelRename();
    }
  };

  return (
    <div className="flex h-7 min-w-0 shrink-0 items-stretch border-t border-border bg-bg pl-4 text-xs">
      <div
        ref={stripRef}
        className="no-scrollbar flex min-w-0 flex-1 items-stretch gap-px overflow-x-auto overflow-y-hidden"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const unread = !active && (unreadIds?.has(tab.id) ?? false);
          const editing = editingId === tab.id;
          return (
            <div
              key={tab.id}
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (editing) return;
                onActivate(tab.id);
              }}
              onMouseDown={(e) => {
                if (editing) return;
                handleMouseDown(e, tab.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                startRename(tab);
              }}
              title={onRename ? "Double-click to rename" : undefined}
              className={cn(
                "group relative flex shrink-0 cursor-default items-center transition-colors",
                active
                  ? "bg-bg-elevated text-fg shadow-[inset_0_-2px_0_0_var(--color-accent)]"
                  : unread
                    ? "text-fg hover:bg-bg-elevated/60"
                    : "text-fg-muted/50 hover:bg-bg-elevated/60 hover:text-fg",
              )}
            >
              <span className="flex min-w-0 max-w-44 items-center gap-2 px-4">
                {unread && !editing && (
                  <span
                    aria-label="Unread"
                    className="h-1.5 w-1.5 shrink-0 bg-accent"
                  />
                )}
                {editing ? (
                  <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={onInputKeyDown}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    maxLength={60}
                    spellCheck={false}
                    className="min-w-0 flex-1 border border-border bg-bg px-1 py-0 text-xs text-fg outline-none focus:border-fg-muted"
                  />
                ) : (
                  <span className="truncate">{tab.label}</span>
                )}
              </span>
              {!editing && (
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
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        aria-label="New tab"
        title="New tab (Ctrl+Shift+N)"
        onClick={onNewSession}
        className="ml-1 flex h-full w-7 shrink-0 items-center justify-center text-fg-muted/60 hover:bg-bg-elevated hover:text-fg"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
