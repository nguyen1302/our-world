"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMapStore, type Place } from "./mapStore";
import { useSmallJourney } from "./journeyStore";

// Vietnam-time parts, matching the server-generated titles (no off-by-one).
function vnParts(iso: string) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { d: g("day"), m: g("month"), y: g("year") };
}
function fmtFull(iso: string): string {
  const { d, m, y } = vnParts(iso);
  return `${d} Tháng ${m}, ${y}`;
}
function dateRange(a: string, b: string): string {
  const pa = vnParts(a);
  const pb = vnParts(b);
  if (pa.d === pb.d && pa.m === pb.m && pa.y === pb.y) return fmtFull(a);
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

function Gallery({
  photos,
  onOpen,
  admin,
  onSetCover,
  onDelete,
}: {
  photos: { id: string; thumbUrl: string | null }[];
  onOpen: (i: number) => void;
  admin?: boolean;
  onSetCover?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div className="ow-gallery">
      {photos.map((ph, i) => (
        <div key={ph.id} className="ow-gcell">
          <img src={ph.thumbUrl ?? ""} alt="" loading="lazy" onClick={() => onOpen(i)} />
          {admin && (
            <div className="ow-gcell__acts">
              <button title="Đặt làm ảnh bìa" onClick={() => onSetCover?.(ph.id)}>★</button>
              <button title="Xoá ảnh" className="ow-gcell__del" onClick={() => onDelete?.(ph.id)}>🗑</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function MemoryCard({
  isAdmin,
  onChanged,
  onAddToPlace,
}: {
  isAdmin: boolean;
  onChanged: () => void;
  onAddToPlace: (memoryId: string) => void;
}) {
  const focusedTripId = useMapStore((s) => s.focusedTripId);
  const tripDetail = useMapStore((s) => s.tripDetail);
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId);
  const exitTrip = useMapStore((s) => s.exitTrip);
  const backToTrip = useMapStore((s) => s.backToTrip);
  const selectPlace = useMapStore((s) => s.selectPlace);
  const updatePlaceLocal = useMapStore((s) => s.updatePlaceLocal);
  const updateTripLocal = useMapStore((s) => s.updateTripLocal);
  const refreshTripDetail = useMapStore((s) => s.refreshTripDetail);
  const startJourney = useSmallJourney((s) => s.start);
  const [lightbox, setLightbox] = useState<{ photos: { id: string; thumbUrl: string | null }[]; i: number } | null>(null);
  const [editMode, setEditMode] = useState(false);

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
      .map((p) => ({ id: p.id, tripId: tripDetail!.trip.id, lat: p.lat, lng: p.lng, title: p.placeName || p.title }));
    if (stops.length > 1) startJourney(stops);
  }
  async function reloadTrip() {
    const d = await fetch(`/api/memories/${focusedTripId}`).then((r) => r.json());
    if (d?.trip) refreshTripDetail(d);
    onChanged();
  }
  async function setCover(placeId: string, photoId: string) {
    await patchPlace(placeId, { coverPhotoId: photoId });
    await reloadTrip();
  }
  async function deletePhoto(photoId: string) {
    if (!confirm("Xoá ảnh này? (xoá luôn khỏi lưu trữ, không khôi phục được)")) return;
    await fetch(`/api/photos/${photoId}`, { method: "DELETE" });
    setLightbox(null);
    await reloadTrip();
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

          <div className="ow-album-head">
            <span className="ow-card__albumlabel">Địa điểm · {place.photos.length} ảnh</span>
            {isAdmin && (
              <div className="ow-album-tools">
                <button className="ow-minibtn" onClick={() => onAddToPlace(place.id)}>➕ Thêm ảnh</button>
                <button className={`ow-minibtn ${editMode ? "ow-minibtn--on" : ""}`} onClick={() => setEditMode((e) => !e)}>
                  {editMode ? "Xong" : "✎ Sửa"}
                </button>
              </div>
            )}
          </div>

          <Gallery
            photos={place.photos}
            onOpen={(i) => setLightbox({ photos: place.photos, i })}
            admin={isAdmin && editMode}
            onSetCover={(pid) => setCover(place.id, pid)}
            onDelete={deletePhoto}
          />
        </div>
        {lightbox && (
          <Lightbox
            {...lightbox}
            admin={isAdmin}
            onClose={() => setLightbox(null)}
            onNav={(i) => setLightbox((l) => l && { ...l, i })}
            onSetCover={(pid) => setCover(place.id, pid)}
            onDelete={deletePhoto}
          />
        )}
      </div>
    );
  }

  // ---- Trip card (level 1 -> big mốc: all photos + place list) ----
  const trip = tripDetail.trip;
  // carry each photo's owning place id so edit actions know which place to touch
  const allPhotos = tripDetail.places.flatMap((p) => p.photos.map((ph) => ({ ...ph, memoryId: p.id })));
  const photoMemory = (pid: string) => (allPhotos.find((x) => x.id === pid) as any)?.memoryId as string | undefined;
  const firstPlaceId = tripDetail.places[0]?.id;
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

        <div className="ow-album-head">
          <span className="ow-card__albumlabel">Tất cả ảnh · {allPhotos.length}</span>
          {isAdmin && (
            <div className="ow-album-tools">
              {firstPlaceId && <button className="ow-minibtn" onClick={() => onAddToPlace(firstPlaceId)}>➕ Thêm ảnh</button>}
              <button className={`ow-minibtn ${editMode ? "ow-minibtn--on" : ""}`} onClick={() => setEditMode((e) => !e)}>
                {editMode ? "Xong" : "✎ Sửa"}
              </button>
            </div>
          )}
        </div>
        <Gallery
          photos={allPhotos}
          onOpen={(i) => setLightbox({ photos: allPhotos, i })}
          admin={isAdmin && editMode}
          onSetCover={(pid) => { const m = photoMemory(pid); if (m) setCover(m, pid); }}
          onDelete={deletePhoto}
        />

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

function Lightbox({
  photos,
  i,
  onClose,
  onNav,
  admin,
  onSetCover,
  onDelete,
}: {
  photos: { id: string; thumbUrl: string | null }[];
  i: number;
  onClose: () => void;
  onNav: (i: number) => void;
  admin?: boolean;
  onSetCover?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const cur = photos[i];
  const prev = () => onNav((i - 1 + photos.length) % photos.length);
  const next = () => onNav((i + 1) % photos.length);
  const touchX = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!mounted) return null;

  const node = (
    <div
      className="ow-lightbox"
      onClick={onClose}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current == null || photos.length < 2) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx > 50) prev();
        else if (dx < -50) next();
        touchX.current = null;
      }}
    >
      <img className="ow-lightbox__img" src={cur?.thumbUrl ?? ""} alt="" onClick={(e) => e.stopPropagation()} />

      <div className="ow-lightbox__top" onClick={(e) => e.stopPropagation()}>
        <span className="ow-lightbox__counter">{i + 1} / {photos.length}</span>
        <div className="ow-lightbox__topacts">
          {admin && cur && (
            <>
              <button className="ow-lightbox__btn" title="Đặt làm ảnh bìa" onClick={() => onSetCover?.(cur.id)}>★</button>
              <button className="ow-lightbox__btn" title="Xoá ảnh" onClick={() => onDelete?.(cur.id)}>🗑</button>
            </>
          )}
          <button className="ow-lightbox__btn" onClick={onClose}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </div>

      {photos.length > 1 && (
        <>
          <button className="ow-lightbox__arrow ow-lightbox__arrow--l" onClick={(e) => { e.stopPropagation(); prev(); }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <button className="ow-lightbox__arrow ow-lightbox__arrow--r" onClick={(e) => { e.stopPropagation(); next(); }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </>
      )}
    </div>
  );
  return createPortal(node, document.body);
}
