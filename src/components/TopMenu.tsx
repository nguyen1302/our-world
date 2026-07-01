"use client";
import { useState } from "react";

export default function TopMenu({
  isAdmin,
  onUploaded,
  onLogout,
  onFaces,
  onMusic,
  onImport,
}: {
  isAdmin: boolean;
  onUploaded: () => void;
  onLogout: () => void;
  onFaces: () => void;
  onMusic: () => void;
  onImport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [backfillMsg, setBackfillMsg] = useState("");

  return (
    <div className="ow-menu">
      <button className="ow-pillbtn ow-iconbtn" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && <div className="ow-menu__backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="ow-menu__pop">
          {isAdmin && (
            <button className="ow-menu__item" onClick={() => { setOpen(false); onImport(); }}>
              ⬆️ Import Photos
            </button>
          )}
          <button className="ow-menu__item" onClick={() => { setOpen(false); onFaces(); }}>
            💕 Ghép mặt vào phương tiện
          </button>
          {isAdmin && (
            <button className="ow-menu__item" onClick={() => { setOpen(false); onMusic(); }}>
              🎵 Nhạc nền
            </button>
          )}
          {isAdmin && (
            <button
              className="ow-menu__item"
              onClick={async () => {
                setBackfillMsg("Đang cập nhật tỉnh…");
                await fetch("/api/admin/backfill", { method: "POST" }).catch(() => {});
                setBackfillMsg("");
                setOpen(false);
                onUploaded();
              }}
            >
              {backfillMsg || "📍 Cập nhật tỉnh thành"}
            </button>
          )}
          <button className="ow-menu__item ow-menu__item--logout" onClick={() => { setOpen(false); onLogout(); }}>
            ⎋ Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
