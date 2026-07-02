"use client";
import { useEffect } from "react";
import { THEMES, useTheme } from "./themeStore";

// Applies the active theme's palette to the document root as --ow-* custom
// properties. The existing --gold/--rose/--cream/--surface... vars are defined
// in terms of these in globals.css, so the whole app recolors with no per-
// component edits. Renders nothing.
export default function ThemeController() {
  const theme = useTheme((s) => s.theme);
  useEffect(() => {
    const T = THEMES[theme] ?? THEMES.nostalgic;
    const r = document.documentElement.style;
    r.setProperty("--ow-accent", T.accent);
    r.setProperty("--ow-accent2", T.accent2);
    r.setProperty("--ow-accent-rgb", T.accentRgb);
    r.setProperty("--ow-text", T.text);
    r.setProperty("--ow-muted", T.muted);
    r.setProperty("--ow-muted2", T.muted2);
    r.setProperty("--ow-ink", T.ink);
    r.setProperty("--ow-glass-rgb", T.glassRgb);
    r.setProperty("--ow-solid-rgb", T.solidRgb);
    r.setProperty("--ow-tile-filter", T.filter);
  }, [theme]);
  return null;
}
