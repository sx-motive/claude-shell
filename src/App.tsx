import { useCallback, useEffect, useRef, useState } from "react";
import { Terminal } from "./components/Terminal";
import { TitleBar } from "./components/TitleBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { TabBar } from "./components/TabBar";
import { useSkipPermissions } from "./settings/skipPermissions";
import { resolveCommand, useClaudePath } from "./settings/claudePath";
import { buildArgs, type SessionMode } from "./lib/sessionArgs";
import { cn } from "./lib/utils";

interface Tab {
  id: string;
  command: string;
  args: string[];
  label: string;
}

function nextId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2, 10)}`;
}

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skipPermissions] = useSkipPermissions();
  const [claudePath] = useClaudePath();

  const counterRef = useRef(2);
  const makeTab = useCallback(
    (mode: SessionMode): Tab => {
      const n = counterRef.current++;
      return {
        id: nextId(),
        command: resolveCommand(claudePath),
        args: buildArgs(skipPermissions, mode),
        label: `Session ${n}`,
      };
    },
    [skipPermissions, claudePath],
  );

  const [tabs, setTabs] = useState<Tab[]>(() => [
    {
      id: nextId(),
      command: resolveCommand(claudePath),
      args: buildArgs(skipPermissions, "new"),
      label: "Session 1",
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string | null>(
    () => tabs[0]?.id ?? null,
  );

  const openTab = useCallback(
    (mode: SessionMode) => {
      const tab = makeTab(mode);
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
    },
    [makeTab],
  );

  const closeTab = useCallback(
    (id: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) return prev;
        const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];
        setActiveTabId((current) => {
          if (current !== id) return current;
          if (next.length === 0) return null;
          const fallback = next[idx - 1] ?? next[idx] ?? next[0];
          return fallback.id;
        });
        return next;
      });
    },
    [],
  );

  const cycleTab = useCallback(
    (direction: 1 | -1) => {
      setActiveTabId((current) => {
        if (tabs.length === 0) return null;
        const idx = current ? tabs.findIndex((t) => t.id === current) : -1;
        const nextIdx = (idx + direction + tabs.length) % tabs.length;
        return tabs[nextIdx].id;
      });
    },
    [tabs],
  );

  const onNewSession = useCallback(() => openTab("new"), [openTab]);
  const onResumeSession = useCallback(() => openTab("resume"), [openTab]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.metaKey) return;

      if (!e.shiftKey && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
        return;
      }

      if (settingsOpen) return;

      if (e.shiftKey && (e.key === "N" || e.key === "n")) {
        e.preventDefault();
        onNewSession();
        return;
      }
      if (e.shiftKey && (e.key === "R" || e.key === "r")) {
        e.preventDefault();
        onResumeSession();
        return;
      }
      if (!e.shiftKey && (e.key === "w" || e.key === "W")) {
        e.preventDefault();
        if (activeTabId) closeTab(activeTabId);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        cycleTab(e.shiftKey ? -1 : 1);
        return;
      }
      if (!e.shiftKey && e.key >= "1" && e.key <= "9") {
        const n = parseInt(e.key, 10);
        if (n <= tabs.length) {
          e.preventDefault();
          setActiveTabId(tabs[n - 1].id);
        }
        return;
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [
    activeTabId,
    closeTab,
    cycleTab,
    onNewSession,
    onResumeSession,
    settingsOpen,
    tabs,
  ]);

  return (
    <main className="flex h-full flex-col overflow-hidden border border-border bg-bg text-fg">
      <TitleBar
        onResumeSession={onResumeSession}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {tabs.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center text-sm text-fg-muted">
            No sessions. Press{" "}
            <kbd className="mx-1 border border-border bg-bg-elevated px-1.5 py-0.5 text-[11px]">
              Ctrl+Shift+N
            </kbd>{" "}
            or click <span className="mx-1 font-semibold">+</span> to start one.
          </div>
        ) : (
          tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "absolute inset-0 px-4",
                tab.id === activeTabId ? "" : "hidden",
              )}
            >
              <Terminal
                command={tab.command}
                args={tab.args}
                active={tab.id === activeTabId}
                className="h-full w-full overflow-hidden"
              />
            </div>
          ))
        )}
      </div>
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onActivate={setActiveTabId}
        onClose={closeTab}
        onNewSession={onNewSession}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </main>
  );
}
