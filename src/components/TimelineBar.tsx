"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMapStore } from "./mapStore";
import { useBigJourney } from "./journeyStore";

const PAD = 50;

// The timeline ALWAYS shows trips (big mốc). Entering a trip does NOT switch the
// timeline to places — it just highlights that trip and zooms the axis in a bit.
export default function TimelineBar() {
  const memories = useMapStore((s) => s.memories);
  const focusedTripId = useMapStore((s) => s.focusedTripId);
  const requestEnterTrip = useMapStore((s) => s.requestEnterTrip);
  const cacheTrips = useMapStore((s) => s.cacheTrips);
  const trackRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const playing = useBigJourney((s) => s.playing);
  const jStops = useBigJourney((s) => s.stops);
  const jIndex = useBigJourney((s) => s.index);
  const startJourney = useBigJourney((s) => s.start);

  // highlight: the trip currently in the journey, else the trip we're inside
  const activeId = playing ? jStops[jIndex]?.id ?? null : focusedTripId;
  // "zoom to lên" when focused on a trip
  const effZoom = focusedTripId || playing ? Math.max(zoom, 2.4) : zoom;

  const beads = useMemo(
    () =>
      [...memories]
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .map((m) => ({ id: m.id, startAt: m.startAt, cover: m.coverThumbUrl, title: m.title })),
    [memories],
  );

  const geom = useMemo(() => {
    if (beads.length === 0) return null;
    const t0 = new Date(beads[0].startAt).getTime();
    const pxPerDay = 2.4 * effZoom;
    const dayOf = (iso: string) => (new Date(iso).getTime() - t0) / 86400000;
    const xOf = (iso: string) => PAD + dayOf(iso) * pxPerDay;
    const totalW = Math.max(560, PAD * 2 + dayOf(beads[beads.length - 1].startAt) * pxPerDay);
    return { xOf, totalW };
  }, [beads, effZoom]);

  const ticks = useMemo(() => {
    if (!geom) return [];
    const seen: Record<string, boolean> = {};
    const out: { label: string; x: number }[] = [];
    for (const b of beads) {
      const y = b.startAt.slice(0, 4);
      if (!seen[y]) {
        seen[y] = true;
        out.push({ label: y, x: geom.xOf(b.startAt) });
      }
    }
    return out;
  }, [beads, geom]);

  // scroll the highlighted trip into view (during journey / when entering a trip)
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const active = el.querySelector('[data-active="1"]') as HTMLElement | null;
    if (active) el.scrollLeft = active.offsetLeft - el.clientWidth / 2 + active.clientWidth / 2;
  }, [activeId, effZoom]);

  async function playBigTrips() {
    const details = await Promise.all(memories.map((m) => fetch(`/api/memories/${m.id}`).then((r) => r.json())));
    cacheTrips(details);
    const stops = [...memories]
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
      .map((m) => ({ id: m.id, tripId: null, lat: m.lat, lng: m.lng, title: m.title }));
    if (stops.length > 1) startJourney(stops);
  }

  const rangeLabel = beads.length ? `${beads[0].startAt.slice(0, 4)} – ${beads[beads.length - 1].startAt.slice(0, 4)}` : "";

  return (
    <div className="ow-tlbar">
      <div className="ow-tl-head">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e9b872" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
        <span className="ow-tl-title">Dòng thời gian</span>
        {beads.length > 0 && <span className="ow-tl-sep">·</span>}
        <span className="ow-tl-range">{rangeLabel}</span>
        <div className="ow-tl-spacer" />
        {beads.length > 1 && !playing && (
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
                  onClick={() => requestEnterTrip(b.id)}
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
