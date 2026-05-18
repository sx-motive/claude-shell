import { describe, expect, it } from "vitest";
import { buildArgs } from "./sessionArgs";

describe("buildArgs", () => {
  it("returns empty when nothing is set", () => {
    expect(buildArgs(false, "new")).toEqual([]);
  });

  it("adds --dangerously-skip-permissions when skipPermissions is true", () => {
    expect(buildArgs(true, "new")).toEqual(["--dangerously-skip-permissions"]);
  });

  it("adds --resume when mode is resume", () => {
    expect(buildArgs(false, "resume")).toEqual(["--resume"]);
  });

  it("combines both flags in stable order (skip first, then resume)", () => {
    expect(buildArgs(true, "resume")).toEqual([
      "--dangerously-skip-permissions",
      "--resume",
    ]);
  });
});
