"use client";
import { useEffect, useState } from "react";
import { useMapStore } from "./mapStore";

interface Detail {
  memory: {
    id: string;
    title: string;
    description: string | null;
    placeName: string | null;
    city: string | null;
    country: string | null;
    startAt: string;
    endAt: string;
  };
  photos: { id: string; thumbUrl: string | null }[];
}

function fmtFull(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}

export default function MemoryCard({ isAdmin, onChanged }: { isAdmin: boolean; onChanged: () => void }) {
  const selectedId = useMapStore((s) => s.selectedId);
  const closeDetail = useMapStore((s) => s.closeDetail);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetail(null);
    setEditingTitle(false);
    setEditingDesc(false);
    setLightbox(null);
    fetch(`/api/memories/${selectedId}`)
      .then((r) => r.json())
      .then((d: Detail) => {
        setDetail(d);
        setTitle(d.memory.title);
        setDescription(d.memory.description ?? "");
      });
  }, [selectedId]);

  if (!selectedId) return null;

  async function patch(body: object) {
    await fetch(`/api/memories/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    onChanged();
  }
  function commitTitle() {
    setEditingTitle(false);
    if (detail && title.trim() && title !== detail.memory.title) {
      setDetail({ ...detail, memory: { ...detail.memory, title: title.trim() } });
      patch({ title: title.trim() });
    }
  }
  function commitDesc() {
    setEditingDesc(false);
    if (detail && description !== (detail.memory.description ?? "")) {
      setDetail({ ...detail, memory: { ...detail.memory, description: description.trim() } });
      patch({ description: description.trim() });
    }
  }
  async function remove() {
    if (!confirm("Chuyển kỷ niệm này vào thùng rác?")) return;
    await fetch(`/api/memories/${selectedId}`, { method: "DELETE" });
    closeDetail();
    onChanged();
  }

  const photos = detail?.photos ?? [];
  const cover = photos[0]?.thumbUrl ?? "";
  const place = detail
    ? [detail.memory.placeName, detail.memory.city, detail.memory.country].filter(Boolean).join(", ")
    : "";
  const desc = detail?.memory.description;

  return (
    <div className="ow-card">
      {!detail ? (
        <div className="ow-card__body">Đang tải…</div>
      ) : (
        <>
          <div className="ow-card__coverwrap">
            <img className="ow-card__cover" src={cover} alt="" loading="lazy" onClick={() => setLightbox(0)} />
            <div className="ow-card__coverfade" />
            <div className="ow-card__close" onClick={closeDetail}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </div>
            <div className="ow-card__placebadge">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>
              <span>{place}</span>
            </div>
          </div>

          <div className="ow-card__body">
            {editingTitle ? (
              <input
                className="ow-card__title-input"
                value={title}
                autoFocus
                onChange={(e) => setTitle(e.target.value)}
                onBlur={commitTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitTitle();
                  if (e.key === "Escape") setEditingTitle(false);
                }}
              />
            ) : (
              <div className="ow-card__titlerow">
                <h2 className="ow-card__title">{detail.memory.title}</h2>
                {isAdmin && (
                  <div className="ow-card__edit" title="Sửa tiêu đề" onClick={() => setEditingTitle(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4.5l5 5M3 21l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L7 20l-4 1z" /></svg>
                  </div>
                )}
              </div>
            )}

            <div className="ow-card__date">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
              <span>{fmtFull(detail.memory.startAt)}</span>
            </div>

            {editingDesc ? (
              <textarea
                className="ow-card__desc-input"
                rows={4}
                autoFocus
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={commitDesc}
              />
            ) : isAdmin ? (
              <div onClick={() => setEditingDesc(true)} style={{ cursor: "text" }}>
                <p className="ow-card__desc">{desc || "(Chưa có mô tả — nhấn để thêm kỷ niệm của bạn.)"}</p>
                <span className="ow-card__edithint">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4.5l5 5M3 21l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L7 20l-4 1z" /></svg>
                  Nhấn để sửa mô tả
                </span>
              </div>
            ) : (
              desc && <p className="ow-card__desc">{desc}</p>
            )}

            <div className="ow-card__albumlabel">Album · {photos.length} ảnh</div>
            <div className="ow-gallery">
              {photos.map((p, i) => (
                <div key={p.id} onClick={() => setLightbox(i)}>
                  <img src={p.thumbUrl ?? ""} alt="" loading="lazy" />
                </div>
              ))}
            </div>

            {isAdmin && (
              <div className="ow-card__actions">
                <button className="ow-danger" onClick={remove}>Xoá kỷ niệm</button>
              </div>
            )}
          </div>
        </>
      )}

      {lightbox != null && photos[lightbox] && (
        <div className="ow-lightbox" onClick={() => setLightbox(null)}>
          <div className="ow-lightbox__inner" onClick={(e) => e.stopPropagation()}>
            <img src={photos[lightbox].thumbUrl ?? ""} alt="" />
            <div className="ow-lightbox__nav">
              <div className="ow-lightbox__btn" onClick={() => setLightbox((i) => (i! - 1 + photos.length) % photos.length)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
              </div>
              <div className="ow-lightbox__counter">{lightbox + 1} / {photos.length}</div>
              <div className="ow-lightbox__btn" onClick={() => setLightbox((i) => (i! + 1) % photos.length)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
              </div>
            </div>
          </div>
          <div className="ow-lightbox__btn ow-lightbox__close" onClick={() => setLightbox(null)}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </div>
        </div>
      )}
    </div>
  );
}
