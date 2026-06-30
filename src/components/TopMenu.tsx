"use client";
import { useState } from "react";
import UploadButton from "./UploadButton";

export default function TopMenu({
  isAdmin,
  onUploaded,
  onLogout,
  onFaces,
  onMusic,
}: {
  isAdmin: boolean;
  onUploaded: () => void;
  onLogout: () => void;
  onFaces: () => void;
  onMusic: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ow-menu">
      <button className="ow-pillbtn ow-iconbtn" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && <div className="ow-menu__backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="ow-menu__pop">
          {isAdmin && (
            <div className="ow-menu__row" onClick={() => setOpen(false)}>
              <UploadButton onUploaded={onUploaded} />
            </div>
          )}
          <button className="ow-menu__item" onClick={() => { setOpen(false); onFaces(); }}>
            💕 Ghép mặt vào phương tiện
          </button>
          {isAdmin && (
            <button className="ow-menu__item" onClick={() => { setOpen(false); onMusic(); }}>
              🎵 Nhạc nền
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
