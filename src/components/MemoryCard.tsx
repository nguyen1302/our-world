"use client";
import { useMemo, useState } from "react";
import { useMapStore, type Place } from "./mapStore";
import { useJourney } from "./journeyStore";

function fmtFull(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} Tháng ${d.getMonth() + 1}, ${d.getFullYear()}`;
}
function dateRange(a: string, b: string): string {
  if (new Date(a).toDateString() === new Date(b).toDateString()) return fmtFull(a);
  return `${fmtFull(a)} – ${fmtFull(b)}`;
}

function EditableTitle({ value, isAdmin, onSave }: { value: string; isAdmin: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  if (editing)
    return (
      <input
        className="ow-card__title-input"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft.trim() && draft !== value) onSave(draft.trim()); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditing(false); }}
      />
    );
  return (
    <div className="ow-card__titlerow">
      <h2 className="ow-card__title">{value}</h2>
      {isAdmin && (
        <div className="ow-card__edit" title="Sửa tiêu đề" onClick={() => { setDraft(value); setEditing(true); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4.5l5 5M3 21l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L7 20l-4 1z" /></svg>
        </div>
      )}
    </div>
  );
}

function EditableDesc({ value, isAdmin, onSave }: { value: string | null; isAdmin: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  if (editing)
    return (
      <textarea
        className="ow-card__desc-input"
        rows={4}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { setEditing(false); if (draft !== (value ?? "")) onSave(draft.trim()); }}
      />
    );
  if (!isAdmin) return value ? <p className="ow-card__desc">{value}</p> : null;
  return (
    <div onClick={() => { setDraft(value ?? ""); setEditing(true); }} style={{ cursor: "text" }}>
      <p className="ow-card__desc">{value || "(Chưa có mô tả — nhấn để thêm kỷ niệm của bạn.)"}</p>
      <span className="ow-card__edithint">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4.5l5 5M3 21l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L7 20l-4 1z" /></svg>
        Nhấn để sửa mô tả
      </span>
    </div>
  );
}

function Gallery({ photos, onOpen }: { photos: { id: string; thumbUrl: string | null }[]; onOpen: (i: number) => void }) {
  return (
    <div className="ow-gallery">
      {photos.map((ph, i) => (
        <div key={ph.id} onClick={() => onOpen(i)}>
          <img src={ph.thumbUrl ?? ""} alt="" loading="lazy" />
        </div>
      ))}
    </div>
  );
}

export default function MemoryCard({ isAdmin, onChanged }: { isAdmin: boolean; onChanged: () => void }) {
  const focusedTripId = useMapStore((s) => s.focusedTripId);
  const tripDetail = useMapStore((s) => s.tripDetail);
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId);
  const exitTrip = useMapStore((s) => s.exitTrip);
  const backToTrip = useMapStore((s) => s.backToTrip);
  const selectPlace = useMapStore((s) => s.selectPlace);
  const updatePlaceLocal = useMapStore((s) => s.updatePlaceLocal);
  const updateTripLocal = useMapStore((s) => s.updateTripLocal);
  const startJourney = useJourney((s) => s.start);
  const [lightbox, setLightbox] = useState<{ photos: { id: string; thumbUrl: string | null }[]; i: number } | null>(null);

  const place: Place | undefined = useMemo(
    () => tripDetail?.places.find((p) => p.id === selectedPlaceId),
    [tripDetail, selectedPlaceId],
  );

  if (!focusedTripId || !tripDetail) return null;

  async function patchTrip(body: object) {
    await fetch(`/api/memories/${focusedTripId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  async function patchPlace(id: string, body: object) {
    await fetch(`/api/places/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  }
  async function removeTrip() {
    if (!confirm("Chuyển chuyến đi này vào thùng rác?")) return;
    await fetch(`/api/memories/${focusedTripId}`, { method: "DELETE" });
    exitTrip();
    onChanged();
  }
  function rideTrip() {
    const stops = tripDetail!.places
      .filter((p) => typeof p.lat === "number")
      .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, title: p.placeName || p.title }));
    if (stops.length > 1) startJourney(stops);
  }

  // ---- Place card (level 2 detail) ----
  if (place) {
    const badge = [place.placeName, place.city].filter(Boolean).join(", ");
    return (
      <div className="ow-card">
        <div className="ow-card__coverwrap">
          <img className="ow-card__cover" src={place.photos[0]?.thumbUrl ?? ""} alt="" loading="lazy" onClick={() => place.photos.length && setLightbox({ photos: place.photos, i: 0 })} />
          <div className="ow-card__coverfade" />
          <div className="ow-card__close" onClick={backToTrip} title="Quay lại chuyến">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </div>
          <div className="ow-card__placebadge">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>
            <span>{badge}</span>
          </div>
        </div>
        <div className="ow-card__body">
          <EditableTitle value={place.title} isAdmin={isAdmin} onSave={(v) => { updatePlaceLocal(place.id, { title: v }); patchPlace(place.id, { title: v }); }} />
          <div className="ow-card__date">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
            <span>{dateRange(place.startAt, place.endAt)}</span>
          </div>
          <EditableDesc value={place.description} isAdmin={isAdmin} onSave={(v) => { updatePlaceLocal(place.id, { description: v }); patchPlace(place.id, { description: v }); }} />
          <div className="ow-card__albumlabel">Địa điểm · {place.photos.length} ảnh</div>
          <Gallery photos={place.photos} onOpen={(i) => setLightbox({ photos: place.photos, i })} />
        </div>
        {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} onNav={(i) => setLightbox((l) => l && { ...l, i })} />}
      </div>
    );
  }

  // ---- Trip card (level 1 -> big mốc: all photos + place list) ----
  const trip = tripDetail.trip;
  const allPhotos = tripDetail.places.flatMap((p) => p.photos);
  const badge = [trip.city, trip.country].filter(Boolean).join(", ");
  const multiPlace = tripDetail.places.length > 1;
  return (
    <div className="ow-card">
      <div className="ow-card__coverwrap">
        <img className="ow-card__cover" src={allPhotos[0]?.thumbUrl ?? ""} alt="" loading="lazy" onClick={() => allPhotos.length && setLightbox({ photos: allPhotos, i: 0 })} />
        <div className="ow-card__coverfade" />
        <div className="ow-card__close" onClick={exitTrip} title="Đóng">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </div>
        <div className="ow-card__placebadge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-5.6-7-11a7 7 0 0 1 14 0c0 5.4-7 11-7 11z" /><circle cx="12" cy="10" r="2.4" /></svg>
          <span>{badge}</span>
        </div>
      </div>
      <div className="ow-card__body">
        <EditableTitle value={trip.title} isAdmin={isAdmin} onSave={(v) => { updateTripLocal({ title: v }); patchTrip({ title: v }); }} />
        <div className="ow-card__date">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></svg>
          <span>{dateRange(trip.startAt, trip.endAt)}</span>
        </div>
        <EditableDesc value={trip.description} isAdmin={isAdmin} onSave={(v) => { updateTripLocal({ description: v }); patchTrip({ description: v }); }} />

        {multiPlace && (
          <button className="ow-card__ride" onClick={rideTrip}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
            Di chuyển ({tripDetail.places.length} nơi)
          </button>
        )}

        {multiPlace && (
          <>
            <div className="ow-card__albumlabel">Các địa điểm</div>
            <div className="ow-placechips">
              {tripDetail.places.map((p) => (
                <button key={p.id} className="ow-placechip" onClick={() => selectPlace(p.id)}>
                  <img src={p.photos[0]?.thumbUrl ?? ""} alt="" />
                  <span>{p.placeName || p.title}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="ow-card__albumlabel">Tất cả ảnh · {allPhotos.length}</div>
        <Gallery photos={allPhotos} onOpen={(i) => setLightbox({ photos: allPhotos, i })} />

        {isAdmin && (
          <div className="ow-card__actions">
            <button className="ow-danger" onClick={removeTrip}>Xoá chuyến đi</button>
          </div>
        )}
      </div>
      {lightbox && <Lightbox {...lightbox} onClose={() => setLightbox(null)} onNav={(i) => setLightbox((l) => l && { ...l, i })} />}
    </div>
  );
}

function Lightbox({ photos, i, onClose, onNav }: { photos: { id: string; thumbUrl: string | null }[]; i: number; onClose: () => void; onNav: (i: number) => void }) {
  return (
    <div className="ow-lightbox" onClick={onClose}>
      <div className="ow-lightbox__inner" onClick={(e) => e.stopPropagation()}>
        <img src={photos[i]?.thumbUrl ?? ""} alt="" />
        <div className="ow-lightbox__nav">
          <div className="ow-lightbox__btn" onClick={() => onNav((i - 1 + photos.length) % photos.length)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </div>
          <div className="ow-lightbox__counter">{i + 1} / {photos.length}</div>
          <div className="ow-lightbox__btn" onClick={() => onNav((i + 1) % photos.length)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </div>
        </div>
      </div>
      <div className="ow-lightbox__btn ow-lightbox__close" onClick={onClose}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </div>
    </div>
  );
}
