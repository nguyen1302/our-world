"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMapStore } from "./mapStore";

interface UnplacedPhoto {
  id: string;
  thumbUrl: string | null;
  takenAt: string | null;
}

export default function UnplacedPanel({ version }: { version: number }) {
  const placingPhotoIds = useMapStore((s) => s.placingPhotoIds);
  const startPlacing = useMapStore((s) => s.startPlacing);
  const cancelPlacing = useMapStore((s) => s.cancelPlacing);
  const [items, setItems] = useState<UnplacedPhoto[]>([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    const d = await fetch("/api/unplaced").then((r) => r.json());
    setItems(d.photos ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  function toggle(id: string) {
    setSel((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // placing banner (map click assigns location to all selected) — portal to body
  // so it isn't trapped by the topbar's backdrop-filter containing block.
  if (placingPhotoIds.length > 0) {
    if (!mounted) return null;
    return createPortal(
      <div className="ow-placing">
        <span className="ow-placing__dot" />
        Bấm lên bản đồ để đặt vị trí cho {placingPhotoIds.length} ảnh
        <button onClick={cancelPlacing}>Huỷ</button>
      </div>,
      document.body,
    );
  }

  if (items.length === 0) return null;

  return (
    <>
      <button className="ow-unplaced-btn" onClick={() => { setOpen(true); setSel(new Set()); }}>
        📍 Chưa định vị <b>{items.length}</b>
      </button>

      {open && mounted && createPortal(
        <div className="ow-modal" onClick={() => setOpen(false)}>
          <div className="ow-modal__box ow-modal__box--wide" onClick={(e) => e.stopPropagation()}>
            <button className="ow-card__close" onClick={() => setOpen(false)}>✕</button>
            <h3>Ảnh chưa có vị trí 📍</h3>
            <p className="ow-modal__desc">
              Ảnh không có GPS (iOS xoá khi chọn từ Thư viện ảnh). <b>Chọn nhiều ảnh cùng nơi chụp</b> rồi
              bấm “Đặt lên bản đồ” → bấm 1 điểm trên bản đồ là gán cho cả nhóm.
              <br />Muốn tự có vị trí: upload ảnh <b>gốc</b> qua “Choose File” (Files/iCloud) hoặc từ máy tính.
            </p>
            <div className="ow-unplaced-grid">
              {items.map((p) => (
                <button
                  key={p.id}
                  className={`ow-unplaced-cell ${sel.has(p.id) ? "ow-unplaced-cell--sel" : ""}`}
                  onClick={() => toggle(p.id)}
                >
                  <img src={p.thumbUrl ?? ""} alt="" loading="lazy" />
                  {sel.has(p.id) && <span className="ow-unplaced-check">✓</span>}
                </button>
              ))}
            </div>
            <div className="ow-unplaced-actions">
              <button className="ow-link" onClick={() => setSel(new Set(items.map((p) => p.id)))}>Chọn tất cả</button>
              <button
                className="ow-primary"
                disabled={sel.size === 0}
                onClick={() => { startPlacing([...sel]); setOpen(false); }}
              >
                Đặt {sel.size || ""} ảnh lên bản đồ →
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
