import type { ITheme } from "@xterm/xterm";

export type ResolvedTheme = "dark" | "light";

const darkTheme: ITheme = {
  background: "#0a0a0b",
  foreground: "#e4e4e7",
  cursor: "#d48256",
  cursorAccent: "#0a0a0b",
  selectionBackground: "#3f3f46",
  black: "#18181b",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#facc15",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#e4e4e7",
  brightBlack: "#52525b",
  brightRed: "#fca5a5",
  brightGreen: "#86efac",
  brightYellow: "#fde68a",
  brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9",
  brightWhite: "#fafafa",
};

const lightTheme: ITheme = {
  background: "#fafafa",
  foreground: "#1f1f23",
  cursor: "#c2410c",
  cursorAccent: "#fafafa",
  selectionBackground: "#d4d4d8",
  black: "#27272a",
  red: "#dc2626",
  green: "#16a34a",
  yellow: "#ca8a04",
  blue: "#2563eb",
  magenta: "#9333ea",
  cyan: "#0891b2",
  white: "#52525b",
  brightBlack: "#3f3f46",
  brightRed: "#ef4444",
  brightGreen: "#22c55e",
  brightYellow: "#eab308",
  brightBlue: "#3b82f6",
  brightMagenta: "#a855f7",
  brightCyan: "#06b6d4",
  brightWhite: "#71717a",
};

export function terminalThemeFor(theme: ResolvedTheme): ITheme {
  return theme === "dark" ? darkTheme : lightTheme;
}
