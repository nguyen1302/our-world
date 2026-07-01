"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMapStore } from "./mapStore";
import { useJourney } from "./journeyStore";

interface Place {
  id: string;
  title: string;
  placeName: string | null;
  city: string | null;
  lat: number;
  lng: number;
  startAt: string;
  endAt: string;
  photos: { id: string; thumbUrl: string | null }[];
}
interface Detail {
  trip: {
    id: string;
    title: string;
    description: string | null;
    city: string | null;
    country: string | null;
    startAt: string;
    endAt: string;
  };
  places: Place[];
}

function fmtFull(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}
function dateRange(a: string, b: string): string {
  const da = new Date(a);
  const db = new Date(b);
  if (da.toDateString() === db.toDateString()) return fmtFull(a);
  return `${fmtFull(a)} – ${fmtFull(b)}`;
}

export default function MemoryCard({ isAdmin, onChanged }: { isAdmin: boolean; onChanged: () => void }) {
  const selectedId = useMapStore((s) => s.selectedId);
  const closeDetail = useMapStore((s) => s.closeDetail);
  const startJourney = useJourney((s) => s.start);
  const journeyPlaying = useJourney((s) => s.playing);
  const activePlaceId = useJourney((s) => s.activePlaceId);
  const placeRefs = useRef<Record<string, HTMLDivElement | null>>({});
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
        setTitle(d.trip.title);
        setDescription(d.trip.description ?? "");
      });
  }, [selectedId]);

  const allPhotos = useMemo(() => (detail ? detail.places.flatMap((p) => p.photos) : []), [detail]);

  // during a place-journey, scroll the active place into view
  useEffect(() => {
    if (activePlaceId && placeRefs.current[activePlaceId]) {
      placeRefs.current[activePlaceId]!.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activePlaceId]);

  if (!selectedId) return null;

  function rideTrip() {
    if (!detail) return;
    const stops = detail.places
      .filter((p) => typeof p.lat === "number")
      .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, title: p.placeName || p.title }));
    if (stops.length > 1) startJourney(stops, "places");
  }

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
    if (detail && title.trim() && title !== detail.trip.title) {
      setDetail({ ...detail, trip: { ...detail.trip, title: title.trim() } });
      patch({ title: title.trim() });
    }
  }
  function commitDesc() {
    setEditingDesc(false);
    if (detail && description !== (detail.trip.description ?? "")) {
      setDetail({ ...detail, trip: { ...detail.trip, description: description.trim() } });
      patch({ description: description.trim() });
    }
  }
  async function remove() {
    if (!confirm("Chuyển chuyến đi này vào thùng rác?")) return;
    await fetch(`/api/memories/${selectedId}`, { method: "DELETE" });
    closeDetail();
    onChanged();
  }

  const cover = allPhotos[0]?.thumbUrl ?? "";
  const place = detail ? [detail.trip.city, detail.trip.country].filter(Boolean).join(", ") : "";
  const desc = detail?.trip.description;
  const multiPlace = (detail?.places.length ?? 0) > 1;

  return (
    <div className="ow-card">
      {!detail ? (
        <div className="ow-card__body">Đang tải…</div>
      ) : (
        <>
          <div className="ow-card__coverwrap">
            <img className="ow-card__cover" src={cover} alt="" loading="lazy" onClick={() => allPhotos.length && setLightbox(0)} />
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
                <h2 className="ow-card__title">{detail.trip.title}</h2>
                {isAdmin && (
                  <div className="ow-card__edit" title="Sửa tiêu đề" onClick={() => setEditingTitle(true)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4.5l5 5M3 21l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L7 20l-4 1z" /></svg>
                  </div>
                )}
              </div>
            )}

            <div className="ow-card__date">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
              <span>{dateRange(detail.trip.startAt, detail.trip.endAt)}</span>
            </div>

            {editingDesc ? (
              <textarea className="ow-card__desc-input" rows={4} autoFocus value={description} onChange={(e) => setDescription(e.target.value)} onBlur={commitDesc} />
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

            {multiPlace && !journeyPlaying && (
              <button className="ow-card__ride" onClick={rideTrip}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
                Đi trong chuyến bằng xe máy ({detail.places.length} nơi)
              </button>
            )}

            {/* Places within the trip */}
            {(() => {
              let offset = 0;
              return detail.places.map((p) => {
                const base = offset;
                offset += p.photos.length;
                return (
                  <div
                    key={p.id}
                    ref={(el) => {
                      placeRefs.current[p.id] = el;
                    }}
                    className={`ow-place ${activePlaceId === p.id ? "ow-place--active" : ""}`}
                  >
                    <div className="ow-card__albumlabel">
                      {multiPlace ? `${p.placeName || p.title} · ${p.photos.length} ảnh` : `Album · ${p.photos.length} ảnh`}
                    </div>
                    <div className="ow-gallery">
                      {p.photos.map((ph, i) => (
                        <div key={ph.id} onClick={() => setLightbox(base + i)}>
                          <img src={ph.thumbUrl ?? ""} alt="" loading="lazy" />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              });
            })()}

            {isAdmin && (
              <div className="ow-card__actions">
                <button className="ow-danger" onClick={remove}>Xoá chuyến đi</button>
              </div>
            )}
          </div>
        </>
      )}

      {lightbox != null && allPhotos[lightbox] && (
        <div className="ow-lightbox" onClick={() => setLightbox(null)}>
          <div className="ow-lightbox__inner" onClick={(e) => e.stopPropagation()}>
            <img src={allPhotos[lightbox].thumbUrl ?? ""} alt="" />
            <div className="ow-lightbox__nav">
              <div className="ow-lightbox__btn" onClick={() => setLightbox((i) => (i! - 1 + allPhotos.length) % allPhotos.length)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
              </div>
              <div className="ow-lightbox__counter">{lightbox + 1} / {allPhotos.length}</div>
              <div className="ow-lightbox__btn" onClick={() => setLightbox((i) => (i! + 1) % allPhotos.length)}>
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
