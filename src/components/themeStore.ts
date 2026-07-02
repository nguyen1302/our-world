"use client";
import { create } from "zustand";

export type ThemeKey = "nostalgic" | "starlit" | "dawn" | "emerald";

export interface Theme {
  key: ThemeKey;
  name: string;
  sub: string;
  accent: string;
  accent2: string;
  accentRgb: string;
  text: string;
  muted: string;
  muted2: string;
  ink: string;
  glassRgb: string;
  solidRgb: string;
  base: "satellite" | "dark";
  filter: string; // tile-pane CSS filter
}

// The 4 themes from the design comp (Memory Map.dc.html).
export const THEMES: Record<ThemeKey, Theme> = {
  nostalgic: {
    key: "nostalgic", name: "Hoài niệm", sub: "Vàng ấm · vệ tinh",
    accent: "#E9B872", accent2: "#D98695", accentRgb: "233,184,114",
    text: "#F4EBE2", muted: "#B7C2B8", muted2: "#8D978C", ink: "#0E1410",
    glassRgb: "16,22,18", solidRgb: "20,26,21", base: "satellite",
    filter: "saturate(1.08) contrast(1.05) brightness(0.96)",
  },
  starlit: {
    key: "starlit", name: "Đêm sao", sub: "Xanh đêm · bản đồ tối",
    accent: "#9DB6FF", accent2: "#C7A6EC", accentRgb: "157,182,255",
    text: "#EEF1FB", muted: "#AAB2CE", muted2: "#878FAC", ink: "#0A0C16",
    glassRgb: "16,18,32", solidRgb: "19,21,36", base: "dark",
    filter: "saturate(0.78) brightness(0.92) contrast(1.08) hue-rotate(198deg)",
  },
  dawn: {
    key: "dawn", name: "Bình minh", sub: "Cam hồng · nắng sớm",
    accent: "#F2A45C", accent2: "#EE8FA6", accentRgb: "242,164,92",
    text: "#FBF0E6", muted: "#D2BCA9", muted2: "#A78E7B", ink: "#17100C",
    glassRgb: "32,20,16", solidRgb: "38,24,19", base: "satellite",
    filter: "saturate(1.12) sepia(0.34) brightness(1.03) contrast(1.02) hue-rotate(-14deg)",
  },
  emerald: {
    key: "emerald", name: "Rừng biếc", sub: "Ngọc lục · thiên nhiên",
    accent: "#5FD1A0", accent2: "#E9C56B", accentRgb: "95,209,160",
    text: "#ECF4EC", muted: "#A8C0AE", muted2: "#7E9784", ink: "#08120D",
    glassRgb: "12,22,16", solidRgb: "16,28,20", base: "satellite",
    filter: "saturate(1.2) contrast(1.05) brightness(0.95) hue-rotate(20deg)",
  },
};

export const THEME_ORDER: ThemeKey[] = ["nostalgic", "starlit", "dawn", "emerald"];

function loadTheme(): ThemeKey {
  if (typeof window === "undefined") return "nostalgic";
  try {
    const v = localStorage.getItem("ow_theme");
    if (v && v in THEMES) return v as ThemeKey;
  } catch {}
  return "nostalgic";
}

interface ThemeState {
  theme: ThemeKey;
  setTheme: (k: ThemeKey) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  theme: loadTheme(),
  setTheme: (k) => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("ow_theme", k);
      } catch {}
    }
    set({ theme: k });
  },
}));
