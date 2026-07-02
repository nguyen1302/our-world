"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMapStore } from "./mapStore";
import { useBigJourney } from "./journeyStore";
import { useApiBase } from "./apiBase";

const PAD = 50;

// The timeline ALWAYS shows trips (big mốc). Entering a trip does NOT switch the
// timeline to places — it just highlights that trip and zooms the axis in a bit.
const GAP = 58; // min px between beads so thumbnails/labels never overlap

export default function TimelineBar() {
  const memories = useMapStore((s) => s.memories);
  const focusedTripId = useMapStore((s) => s.focusedTripId);
  const requestEnterTrip = useMapStore((s) => s.requestEnterTrip);
  const cacheTrips = useMapStore((s) => s.cacheTrips);
  const baseLayer = useMapStore((s) => s.baseLayer);
  const toggleBaseLayer = useMapStore((s) => s.toggleBaseLayer);
  const placingPhotoIds = useMapStore((s) => s.placingPhotoIds);
  const cancelPlacing = useMapStore((s) => s.cancelPlacing);
  const apiBase = useApiBase();
  const trackRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const playing = useBigJourney((s) => s.playing);
  const jStops = useBigJourney((s) => s.stops);
  const jIndex = useBigJourney((s) => s.index);
  const startJourney = useBigJourney((s) => s.start);
  const travelTo = useBigJourney((s) => s.travelTo);
  const placing = placingPhotoIds.length > 0;

  // Tapping a bead does one of three things depending on mode.
  async function onBead(id: string) {
    // 1) placing unplaced photos → add the whole selection to THIS trip
    if (placingPhotoIds.length > 0) {
      const ids = placingPhotoIds;
      cancelPlacing();
      await Promise.all(
        ids.map((pid) =>
          fetch(`/api/photos/${pid}/locate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId: id }),
          }).catch(() => null),
        ),
      );
      window.dispatchEvent(new Event("ow:refresh"));
      return;
    }
    // 2) during a journey → drive the vehicle from here to the chosen stop
    if (playing) {
      const idx = jStops.findIndex((s) => s.id === id);
      if (idx >= 0) travelTo(idx);
      return;
    }
    // 3) normal → open the trip
    requestEnterTrip(id);
  }

  const activeId = playing ? jStops[jIndex]?.id ?? null : focusedTripId;

  const beads = useMemo(
    () =>
      [...memories]
        .sort((a, b) => a.startAt.localeCompare(b.startAt))
        .map((m) => ({ id: m.id, startAt: m.startAt, cover: m.coverThumbUrl, title: m.title })),
    [memories],
  );

  // Positions: time-proportional, but enforce a minimum gap so clustered trips
  // don't pile up into an unreadable blob (fixes the overlapping dates).
  const layout = useMemo(() => {
    if (beads.length === 0) return null;
    const t0 = new Date(beads[0].startAt).getTime();
    const pxPerDay = 3 * zoom;
    let x = PAD;
    const xs: number[] = [];
    for (let i = 0; i < beads.length; i++) {
      const timeX = PAD + ((new Date(beads[i].startAt).getTime() - t0) / 86400000) * pxPerDay;
      x = i === 0 ? PAD : Math.max(timeX, xs[i - 1] + GAP);
      xs.push(x);
    }
    // year dividers between beads whose year changes (midpoint)
    const years: { label: string; x: number }[] = [];
    for (let i = 1; i < beads.length; i++) {
      const y = beads[i].startAt.slice(0, 4);
      if (y !== beads[i - 1].startAt.slice(0, 4)) years.push({ label: y, x: (xs[i - 1] + xs[i]) / 2 });
    }
    return { xs, years, totalW: Math.max(560, xs[xs.length - 1] + PAD), firstYear: beads[0].startAt.slice(0, 4) };
  }, [beads, zoom]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const active = el.querySelector('[data-active="1"]') as HTMLElement | null;
    if (active) el.scrollLeft = active.offsetLeft - el.clientWidth / 2 + active.clientWidth / 2;
  }, [activeId, zoom]);

  async function playBigTrips() {
    const details = await Promise.all(memories.map((m) => fetch(`${apiBase}/memories/${m.id}`).then((r) => r.json())));
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
        <button className="ow-tl-base" onClick={toggleBaseLayer} title="Đổi kiểu bản đồ">
          {baseLayer === "satellite" ? "🗺️" : "🛰️"}
        </button>
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
          <div className="ow-tlbar__inner" style={{ width: layout!.totalW }}>
            <div className="ow-tl-axis" />
            <div className="ow-tltick" style={{ left: PAD - 18 }}>
              <div className="ow-tltick__label">{layout!.firstYear}</div>
            </div>
            {layout!.years.map((y, i) => (
              <div className="ow-tlyear" key={i} style={{ left: y.x }}>
                <div className="ow-tlyear__line" />
                <div className="ow-tlyear__chip">🎆 {y.label}</div>
              </div>
            ))}
            {beads.map((b, i) => {
              const active = b.id === activeId;
              return (
                <div
                  key={b.id}
                  data-active={active ? "1" : "0"}
                  className={`ow-tlbead ${active ? "ow-tlbead--active" : ""} ${placing ? "ow-tlbead--placing" : ""}`}
                  style={{ left: layout!.xs[i], zIndex: active ? 4 : 3 }}
                  onClick={() => onBead(b.id)}
                  title={placing ? "Thêm ảnh đã chọn vào mốc này" : b.title}
                >
                  <div className="ow-tlbead__thumb">
                    <img src={b.cover ?? ""} alt="" loading="lazy" />
                  </div>
                  {/* always show day/month (NOT year — year lives in the divider) */}
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
