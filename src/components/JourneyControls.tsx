"use client";
import { useEffect, useState } from "react";
import type { StoreApi, UseBoundStore } from "zustand";
import { useBigJourney, useSmallJourney, type JourneyState } from "./journeyStore";
import { useMapStore } from "./mapStore";
import { startMusic, stopMusic, setMusicMuted, isMusicMuted } from "./journeyMusic";

type JourneyStore = UseBoundStore<StoreApi<JourneyState>>;

function Panel({
  store,
  variant,
  stepWord,
  badge,
  icon,
  onNext,
  onExit,
}: {
  store: JourneyStore;
  variant: "big" | "small";
  stepWord: string;
  badge: string;
  icon: string;
  onNext: () => void;
  onExit: () => void;
}) {
  const phase = store((s) => s.phase);
  const index = store((s) => s.index);
  const stops = store((s) => s.stops);
  const [muted, setMuted] = useState(isMusicMuted());

  const total = stops.length;
  const last = index >= total - 1;
  const paused = phase === "paused";
  const cur = stops[index];
  const nextStop = stops[index + 1];
  const status = paused ? cur?.title ?? "" : `Đang đến ${nextStop?.title ?? ""}`;

  return (
    <div className={`ow-journey ow-journey--${variant}`}>
      <div className="ow-journey__badge">
        <span className="ow-journey__badge-ic">{icon}</span>
        {badge}
      </div>
      <div className="ow-journey__exit" onClick={onExit}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        Thoát
      </div>
      <div className="ow-journey__mute" onClick={() => { const m = !muted; setMuted(m); setMusicMuted(m); }} title={muted ? "Bật nhạc" : "Tắt nhạc"}>
        {muted ? "🔇" : "🎵"}
      </div>
      <div className="ow-journey__center">
        <div className="ow-journey__step">{stepWord} {index + 1} / {total} · chạm timeline để tới chặng khác</div>
        <div className="ow-journey__status">{status}</div>
      </div>
      {paused ? (
        <div className="ow-journey__next" onClick={last ? onExit : onNext}>
          <span>{last ? "Kết thúc" : "Tiếp"}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </div>
      ) : (
        <div className="ow-journey__moving"><span />Đang đi…</div>
      )}
    </div>
  );
}

export default function JourneyControls() {
  const bigPlaying = useBigJourney((s) => s.playing);
  const smallPlaying = useSmallJourney((s) => s.playing);
  const exitTrip = useMapStore((s) => s.exitTrip);
  const backToTrip = useMapStore((s) => s.backToTrip);
  const detailOpen = useMapStore((s) => s.journeyDetailOpen);
  const toggleDetail = useMapStore((s) => s.toggleJourneyDetail);

  // one soundtrack shared by both journeys — start once, stop only when BOTH stop
  // (startMusic is idempotent, so toggling the small panel won't restart it)
  useEffect(() => {
    if (bigPlaying || smallPlaying) startMusic();
    else stopMusic();
  }, [bigPlaying, smallPlaying]);
  useEffect(() => () => stopMusic(), []);

  function bigNext() {
    // pressing big "Tiếp" abandons any small ride and moves to the next big mốc
    if (useSmallJourney.getState().playing) useSmallJourney.getState().exit();
    useBigJourney.getState().next();
  }
  function bigExit() {
    useSmallJourney.getState().exit();
    useBigJourney.getState().exit();
    exitTrip();
  }
  function smallNext() {
    useSmallJourney.getState().next();
  }
  function smallExit() {
    useSmallJourney.getState().exit();
    backToTrip();
  }

  return (
    <>
      {/* mobile-only: open/close the stop's detail while journeying (map stays visible) */}
      <button className="ow-jdetail-btn" onClick={toggleDetail}>
        {detailOpen ? "▾ Ẩn chi tiết" : "▸ Chi tiết"}
      </button>
      {bigPlaying && <Panel store={useBigJourney} variant="big" badge="Mốc lớn · Chuyến đi" icon="✦" stepWord="Chặng" onNext={bigNext} onExit={bigExit} />}
      {smallPlaying && <Panel store={useSmallJourney} variant="small" badge="Mốc nhỏ · Trong chuyến" icon="↳" stepWord="Điểm" onNext={smallNext} onExit={smallExit} />}
    </>
  );
}
