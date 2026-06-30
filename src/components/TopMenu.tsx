"use client";
import { useState } from "react";
import { useMapStore } from "./mapStore";
import UploadButton from "./UploadButton";

export default function TopMenu({
  isAdmin,
  onUploaded,
  onLogout,
  onFaces,
}: {
  isAdmin: boolean;
  onUploaded: () => void;
  onLogout: () => void;
  onFaces: () => void;
}) {
  const [open, setOpen] = useState(false);
  const showRoute = useMapStore((s) => s.showRoute);
  const toggleRoute = useMapStore((s) => s.toggleRoute);

  return (
    <div className="ow-menu">
      <button className="ow-menu__btn" aria-label="Menu" onClick={() => setOpen((o) => !o)}>
        ☰
      </button>
      {open && <div className="ow-menu__backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="ow-menu__pop">
          {isAdmin && (
            <div className="ow-menu__row" onClick={() => setOpen(false)}>
              <UploadButton onUploaded={onUploaded} />
            </div>
          )}
          <button
            className="ow-menu__item"
            onClick={() => {
              toggleRoute();
            }}
          >
            {showRoute ? "🫥 Ẩn hành trình" : "💞 Hiện hành trình"}
          </button>
          <button
            className="ow-menu__item"
            onClick={() => {
              setOpen(false);
              onFaces();
            }}
          >
            💕 Ghép mặt vào phương tiện
          </button>
          <button
            className="ow-menu__item ow-menu__item--logout"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            ⎋ Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
