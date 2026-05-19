export type SessionMode =
  | { kind: "new" }
  | { kind: "resume" }
  | { kind: "resume-id"; sessionId: string };

export function buildArgs(
  skipPermissions: boolean,
  mode: SessionMode,
): string[] {
  const out: string[] = [];
  if (skipPermissions) out.push("--dangerously-skip-permissions");
  if (mode.kind === "resume") {
    out.push("--resume");
  } else if (mode.kind === "resume-id") {
    out.push("--resume", mode.sessionId);
  }
  return out;
}
