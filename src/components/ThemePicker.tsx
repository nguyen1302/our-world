"use client";
import { useState } from "react";
import { THEMES, THEME_ORDER, useTheme } from "./themeStore";

// Top-bar "Giao diện" dropdown — pick one of the 4 themes (design comp).
export default function ThemePicker() {
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const cur = THEMES[theme] ?? THEMES.nostalgic;

  return (
    <div className="ow-theme">
      <button className={`ow-pillbtn ow-theme__btn ${open ? "ow-theme__btn--on" : ""}`} onClick={() => setOpen((o) => !o)}>
        <span className="ow-theme__swatch" style={{ background: `linear-gradient(135deg,${cur.accent},${cur.accent2})`, boxShadow: `0 0 8px ${cur.accent}88` }} />
        <span>Giao diện</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform .2s ease", transform: open ? "rotate(180deg)" : "none", opacity: 0.7 }}><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && <div className="ow-theme__backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="ow-theme__pop">
          <div className="ow-theme__label">Chọn giao diện</div>
          {THEME_ORDER.map((k) => {
            const t = THEMES[k];
            const active = k === theme;
            return (
              <div key={k} className={`ow-theme__row ${active ? "ow-theme__row--on" : ""}`} onClick={() => { setTheme(k); setOpen(false); }}>
                <span className="ow-theme__swatch" style={{ background: `linear-gradient(135deg,${t.accent},${t.accent2})`, boxShadow: `0 0 8px ${t.accent}88` }} />
                <div className="ow-theme__meta">
                  <div className="ow-theme__name">{t.name}</div>
                  <div className="ow-theme__sub">{t.sub}</div>
                </div>
                {active && (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={t.accent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
