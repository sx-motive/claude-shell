import { spawnSync } from "node:child_process";

const pattern =
  "(\\-p\\b|--print|--output-format|--input-format|stream-json|claude-agent-sdk|anthropic-ai/claude-agent-sdk|api\\.anthropic\\.com|ANTHROPIC_API_KEY)";

const result = spawnSync(
  "git",
  [
    "grep",
    "-nIE",
    pattern,
    "--",
    ":!CLAUDE.md",
    ":!README.md",
    ":!package-lock.json",
    ":!package.json",
    ":!src-tauri/Cargo.lock",
    ":!scripts/check-billing.mjs",
  ],
  { encoding: "utf8" },
);

if (result.status === 1) {
  console.log("billing-invariant grep: clean");
  process.exit(0);
}

if (result.status === 0) {
  console.error("billing-invariant grep FOUND forbidden patterns:");
  console.error(result.stdout);
  process.exit(1);
}

console.error("git grep failed:", result.stderr);
process.exit(result.status ?? 2);
