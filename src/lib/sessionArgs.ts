export type SessionMode = "new" | "resume";

export function buildArgs(
  skipPermissions: boolean,
  mode: SessionMode,
): string[] {
  const out: string[] = [];
  if (skipPermissions) out.push("--dangerously-skip-permissions");
  if (mode === "resume") out.push("--resume");
  return out;
}
