import { useCallback, useEffect, useState } from "react";
import { Terminal } from "./components/Terminal";
import { TitleBar } from "./components/TitleBar";
import { SettingsDialog } from "./components/SettingsDialog";
import { useSkipPermissions } from "./settings/skipPermissions";

type SessionMode = "new" | "resume";

function buildArgs(skipPermissions: boolean, mode: SessionMode): string[] {
  const out: string[] = [];
  if (skipPermissions) out.push("--dangerously-skip-permissions");
  if (mode === "resume") out.push("--resume");
  return out;
}

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [skipPermissions] = useSkipPermissions();

  const [activeArgs, setActiveArgs] = useState<string[]>(() =>
    buildArgs(skipPermissions, "new"),
  );
  const [sessionNonce, setSessionNonce] = useState(0);

  const restart = useCallback(
    (mode: SessionMode) => {
      setActiveArgs(buildArgs(skipPermissions, mode));
      setSessionNonce((n) => n + 1);
    },
    [skipPermissions],
  );

  const onNewSession = useCallback(() => restart("new"), [restart]);
  const onResumeSession = useCallback(() => restart("resume"), [restart]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!e.shiftKey && e.key === ",") {
          e.preventDefault();
          setSettingsOpen((prev) => !prev);
          return;
        }
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
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [onNewSession, onResumeSession]);

  return (
    <main className="flex h-full flex-col overflow-hidden bg-bg text-fg">
      <TitleBar
        onNewSession={onNewSession}
        onResumeSession={onResumeSession}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <div className="min-h-0 flex-1 overflow-hidden px-4 pb-4">
        <Terminal
          key={sessionNonce}
          command="claude"
          args={activeArgs}
          className="h-full w-full overflow-hidden"
        />
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </main>
  );
}
