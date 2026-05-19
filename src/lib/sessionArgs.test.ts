import { describe, expect, it } from "vitest";
import { buildArgs } from "./sessionArgs";

describe("buildArgs", () => {
  it("returns empty when nothing is set", () => {
    expect(buildArgs(false, { kind: "new" })).toEqual([]);
  });

  it("adds --dangerously-skip-permissions when skipPermissions is true", () => {
    expect(buildArgs(true, { kind: "new" })).toEqual([
      "--dangerously-skip-permissions",
    ]);
  });

  it("adds --resume when mode is resume", () => {
    expect(buildArgs(false, { kind: "resume" })).toEqual(["--resume"]);
  });

  it("adds --resume <id> when mode targets a specific session", () => {
    expect(buildArgs(false, { kind: "resume-id", sessionId: "abc-123" })).toEqual(
      ["--resume", "abc-123"],
    );
  });

  it("combines both flags in stable order (skip first, then resume)", () => {
    expect(buildArgs(true, { kind: "resume" })).toEqual([
      "--dangerously-skip-permissions",
      "--resume",
    ]);
  });
});
