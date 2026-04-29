export interface Palette {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  userBg: string;
  userFg: string;
  assistantBg: string;
  assistantFg: string;
  systemBg: string;
  systemFg: string;
  codeBg: string;
  codeFg: string;
  toolBg: string;
  toolBorder: string;
  toolHeaderFg: string;
  toolResultBg: string;
  errorBg: string;
  errorBorder: string;
  reasoningFg: string;
  reasoningBg: string;
  subagentRule: string;
  subagentBadgeBg: string;
  subagentBadgeFg: string;
  rule: string;
}

export const lightPalette: Palette = {
  bg: "#FFFFFF",
  fg: "#111418",
  muted: "#6A7280",
  accent: "#2563EB",
  userBg: "#F1F5F9",
  userFg: "#0F172A",
  assistantBg: "#FFFFFF",
  assistantFg: "#111418",
  systemBg: "#F9FAFB",
  systemFg: "#4B5563",
  codeBg: "#F3F4F6",
  codeFg: "#111418",
  toolBg: "#EFF6FF",
  toolBorder: "#BFDBFE",
  toolHeaderFg: "#1D4ED8",
  toolResultBg: "#F8FAFC",
  errorBg: "#FEF2F2",
  errorBorder: "#FCA5A5",
  reasoningFg: "#6B7280",
  reasoningBg: "#FAFAF9",
  subagentRule: "#A78BFA",
  subagentBadgeBg: "#F5F3FF",
  subagentBadgeFg: "#6D28D9",
  rule: "#E5E7EB",
};

export const darkPalette: Palette = {
  bg: "#0B1020",
  fg: "#E5E7EB",
  muted: "#9CA3AF",
  accent: "#60A5FA",
  userBg: "#111827",
  userFg: "#F9FAFB",
  assistantBg: "#0B1020",
  assistantFg: "#E5E7EB",
  systemBg: "#0F172A",
  systemFg: "#9CA3AF",
  codeBg: "#0F172A",
  codeFg: "#E5E7EB",
  toolBg: "#0F1A2E",
  toolBorder: "#1E3A5F",
  toolHeaderFg: "#93C5FD",
  toolResultBg: "#0B1326",
  errorBg: "#1F1010",
  errorBorder: "#7F1D1D",
  reasoningFg: "#9CA3AF",
  reasoningBg: "#0E1322",
  subagentRule: "#A78BFA",
  subagentBadgeBg: "#1E1B4B",
  subagentBadgeFg: "#C4B5FD",
  rule: "#1F2937",
};

export interface Theme {
  palette: Palette;
  fontSize: {
    title: number;
    h1: number;
    h2: number;
    body: number;
    small: number;
    mono: number;
  };
  spacing: {
    paragraph: number;
    block: number;
    section: number;
    pad: number;
  };
  page: {
    margin: number;
    width: number;
    height: number;
  };
}

export function makeTheme(dark: boolean): Theme {
  return {
    palette: dark ? darkPalette : lightPalette,
    fontSize: {
      title: 22,
      h1: 16,
      h2: 12,
      body: 10.5,
      small: 8.5,
      mono: 9.5,
    },
    spacing: {
      paragraph: 4,
      block: 8,
      section: 14,
      pad: 8,
    },
    page: {
      margin: 50,
      width: 595.28, // A4
      height: 841.89,
    },
  };
}
