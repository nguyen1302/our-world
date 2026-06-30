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

export default function MemoryCard({ isAdmin, onChanged }: { isAdmin: boolean; onChanged: () => void }) {
  const selectedId = useMapStore((s) => s.selectedId);
  const closeDetail = useMapStore((s) => s.closeDetail);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setDetail(null);
    fetch(`/api/memories/${selectedId}`)
      .then((r) => r.json())
      .then((d: Detail) => {
        setDetail(d);
        setTitle(d.memory.title);
        setDescription(d.memory.description ?? "");
      });
  }, [selectedId]);

  if (!selectedId) return null;

  async function save() {
    await fetch(`/api/memories/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    onChanged();
  }

  async function openFull(photoId: string) {
    const r = await fetch(`/api/photos/${photoId}/url`).then((x) => x.json());
    setLightbox(r.url);
  }

  async function remove() {
    if (!confirm("Chuyển kỷ niệm này vào thùng rác?")) return;
    await fetch(`/api/memories/${selectedId}`, { method: "DELETE" });
    closeDetail();
    onChanged();
  }

  return (
    <div className="ow-card">
      <button className="ow-card__close" onClick={() => closeDetail()}>
        ✕
      </button>
      {!detail ? (
        <p>Đang tải…</p>
      ) : (
        <>
          {isAdmin ? (
            <input className="ow-card__title-input" value={title} onChange={(e) => setTitle(e.target.value)} />
          ) : (
            <h2 className="ow-card__title">{detail.memory.title}</h2>
          )}
          <p className="ow-card__meta">
            {[detail.memory.placeName, detail.memory.city, detail.memory.country]
              .filter(Boolean)
              .join(" · ")}
            <br />
            {new Date(detail.memory.startAt).toLocaleDateString("vi-VN")} –{" "}
            {new Date(detail.memory.endAt).toLocaleDateString("vi-VN")}
          </p>

          <div className="ow-gallery">
            {detail.photos.map((p) => (
              <img
                key={p.id}
                src={p.thumbUrl ?? ""}
                alt=""
                loading="lazy"
                onClick={() => openFull(p.id)}
              />
            ))}
          </div>

          {isAdmin ? (
            <>
              <textarea
                className="ow-card__desc-input"
                placeholder="Viết về kỷ niệm này…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="ow-card__actions">
                <button onClick={save}>Lưu</button>
                <button className="ow-danger" onClick={remove}>
                  Xóa
                </button>
              </div>
            </>
          ) : (
            detail.memory.description && <p className="ow-card__desc">{detail.memory.description}</p>
          )}
        </>
      )}

      {lightbox && (
        <div className="ow-lightbox" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}
