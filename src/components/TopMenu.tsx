"use client";
import { useState } from "react";
import UploadButton from "./UploadButton";

async function rethumbAll(onProgress: (msg: string) => void, onDone: () => void) {
  for (let i = 0; i < 100; i++) {
    const r = await fetch("/api/admin/rethumb", { method: "POST" }).then((x) => x.json());
    if (!r || typeof r.remaining !== "number") break;
    onProgress(`Đang tạo lại ảnh… còn ${r.remaining}`);
    if (r.remaining === 0 || r.fixed === 0) break;
  }
  onDone();
}

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
  const [rethumbMsg, setRethumbMsg] = useState("");

  return (
    <div className="ow-menu">
      <button className="ow-pillbtn ow-iconbtn" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
      </button>
      {open && <div className="ow-menu__backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="ow-menu__pop">
          {isAdmin && (
            /* NOTE: do NOT close the menu here — closing unmounts UploadButton
               before the file dialog / onChange runs, so nothing uploads. */
            <div className="ow-menu__row">
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
          {isAdmin && (
            <button
              className="ow-menu__item"
              onClick={() =>
                rethumbAll(setRethumbMsg, () => {
                  setRethumbMsg("");
                  onUploaded();
                })
              }
            >
              {rethumbMsg || "🖼️ Tạo lại ảnh lỗi"}
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
