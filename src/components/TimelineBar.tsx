"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMapStore } from "./mapStore";
import { useJourney } from "./journeyStore";

const PAD = 50;

interface Bead {
  id: string;
  startAt: string;
  cover: string | null;
  title: string;
}

export default function TimelineBar() {
  const memories = useMapStore((s) => s.memories);
  const focusedTripId = useMapStore((s) => s.focusedTripId);
  const tripDetail = useMapStore((s) => s.tripDetail);
  const selectedPlaceId = useMapStore((s) => s.selectedPlaceId);
  const requestEnterTrip = useMapStore((s) => s.requestEnterTrip);
  const selectPlace = useMapStore((s) => s.selectPlace);
  const exitTrip = useMapStore((s) => s.exitTrip);
  const cacheTrips = useMapStore((s) => s.cacheTrips);
  const trackRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const playing = useJourney((s) => s.playing);
  const startJourney = useJourney((s) => s.start);

  const level2 = !!focusedTripId && !!tripDetail;
  const activeId = level2 ? selectedPlaceId : null;

  const beads: Bead[] = useMemo(() => {
    const src = level2
      ? tripDetail!.places.map((p) => ({ id: p.id, startAt: p.startAt, cover: p.photos[0]?.thumbUrl ?? null, title: p.placeName || p.title }))
      : memories.map((m) => ({ id: m.id, startAt: m.startAt, cover: m.coverThumbUrl, title: m.title }));
    return [...src].sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [level2, tripDetail, memories]);

  const geom = useMemo(() => {
    if (beads.length === 0) return null;
    const t0 = new Date(beads[0].startAt).getTime();
    const span = new Date(beads[beads.length - 1].startAt).getTime() - t0;
    // adapt scale: trips span years, places span hours — normalize to a readable width
    const pxPerDay = (level2 ? 40 : 2.4) * zoom;
    const dayOf = (iso: string) => (new Date(iso).getTime() - t0) / 86400000;
    const xOf = (iso: string) => PAD + dayOf(iso) * pxPerDay;
    const totalW = Math.max(560, PAD * 2 + dayOf(beads[beads.length - 1].startAt) * pxPerDay);
    return { xOf, totalW, span };
  }, [beads, zoom, level2]);

  const ticks = useMemo(() => {
    if (!geom) return [];
    const seen: Record<string, boolean> = {};
    const out: { label: string; x: number }[] = [];
    for (const b of beads) {
      const key = level2 ? b.startAt.slice(0, 10) : b.startAt.slice(0, 4);
      if (!seen[key]) {
        seen[key] = true;
        const label = level2 ? `${Number(b.startAt.slice(8, 10))}/${Number(b.startAt.slice(5, 7))}` : key;
        out.push({ label, x: geom.xOf(b.startAt) });
      }
    }
    return out;
  }, [beads, geom, level2]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const active = el.querySelector('[data-active="1"]') as HTMLElement | null;
    if (active) el.scrollLeft = active.offsetLeft - el.clientWidth / 2 + active.clientWidth / 2;
  }, [activeId, zoom, level2]);

  // big journey: ride between the trips (big mốc). Prefetch each trip's places so
  // the trip detail card is ready when we stop at it.
  async function playBigTrips() {
    const details = await Promise.all(memories.map((m) => fetch(`/api/memories/${m.id}`).then((r) => r.json())));
    cacheTrips(details);
    const stops = [...memories]
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((m) => ({ id: m.id, tripId: null, lat: m.lat, lng: m.lng, title: m.title }));
    if (stops.length > 1) startJourney(stops, "trips");
  }

  const title = level2 ? tripDetail!.trip.title : "Dòng thời gian";
  const rangeLabel = beads.length
    ? level2
      ? `${beads.length} địa điểm`
      : `${beads[0].startAt.slice(0, 4)} – ${beads[beads.length - 1].startAt.slice(0, 4)}`
    : "";

  return (
    <div className="ow-tlbar">
      <div className="ow-tl-head">
        {level2 ? (
          <button className="ow-tl-back" onClick={exitTrip} title="Quay lại các chuyến">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
        ) : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e9b872" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
        )}
        <span className="ow-tl-title">{title}</span>
        {beads.length > 0 && <span className="ow-tl-sep">·</span>}
        <span className="ow-tl-range">{rangeLabel}</span>
        <div className="ow-tl-spacer" />
        {!level2 && beads.length > 1 && !playing && (
          <button className="ow-tl-play" onClick={playBigTrips}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z" /></svg>
            Chuyến đi
          </button>
        )}
        <div className="ow-tl-zoom">
          <button onClick={() => setZoom((z) => Math.max(0.45, z / 1.55))} title="Thu nhỏ">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14" /></svg>
          </button>
          <span />
          <button onClick={() => setZoom((z) => Math.min(4, z * 1.55))} title="Phóng to">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>

      {beads.length === 0 ? (
        <div className="ow-tlempty">Chưa có kỷ niệm nào — hãy import ảnh.</div>
      ) : (
        <div className="ow-tlbar__track" ref={trackRef}>
          <div className="ow-tlbar__inner" style={{ width: geom!.totalW }}>
            <div className="ow-tl-axis" />
            {ticks.map((t, i) => (
              <div className="ow-tltick" key={i} style={{ left: t.x - 18 }}>
                <div className="ow-tltick__line" />
                <div className="ow-tltick__label">{t.label}</div>
              </div>
            ))}
            {beads.map((b) => {
              const active = b.id === activeId;
              return (
                <div
                  key={b.id}
                  data-active={active ? "1" : "0"}
                  className={`ow-tlbead ${active ? "ow-tlbead--active" : ""}`}
                  style={{ left: geom!.xOf(b.startAt), zIndex: active ? 4 : 3 }}
                  onClick={() => (level2 ? selectPlace(b.id) : requestEnterTrip(b.id))}
                  title={b.title}
                >
                  <div className="ow-tlbead__thumb">
                    <img src={b.cover ?? ""} alt="" loading="lazy" />
                  </div>
                  <div className="ow-tlbead__label">
                    {Number(b.startAt.slice(8, 10))}/{Number(b.startAt.slice(5, 7))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
