"use client";
import { useEffect, useState } from "react";
import { useJourney } from "./journeyStore";
import { useMapStore } from "./mapStore";
import { startMusic, stopMusic, setMusicMuted, isMusicMuted } from "./journeyMusic";

export default function JourneyControls() {
  const playing = useJourney((s) => s.playing);
  const phase = useJourney((s) => s.phase);
  const index = useJourney((s) => s.index);
  const stops = useJourney((s) => s.stops);
  const next = useJourney((s) => s.next);
  const exit = useJourney((s) => s.exit);
  const setActivePlace = useJourney((s) => s.setActivePlace);
  const closeDetail = useMapStore((s) => s.closeDetail);
  const [muted, setMuted] = useState(isMusicMuted());

  useEffect(() => {
    if (playing) startMusic();
    else stopMusic();
    return () => stopMusic();
  }, [playing]);

  if (!playing) return null;
  const total = stops.length;
  const last = index >= total - 1;
  const paused = phase === "paused";
  const cur = stops[index];
  const nextStop = stops[index + 1];
  const status = paused ? cur?.title ?? "" : `Đang đến ${nextStop?.title ?? ""}`;
  const stepLabel = "Điểm";

  return (
    <div className="ow-journey">
      <div className="ow-journey__exit" onClick={() => { exit(); setActivePlace(null); closeDetail(); }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        Thoát
      </div>
      <div className="ow-journey__mute" onClick={() => { const m = !muted; setMuted(m); setMusicMuted(m); }} title={muted ? "Bật nhạc" : "Tắt nhạc"}>
        {muted ? "🔇" : "🎵"}
      </div>
      <div className="ow-journey__center">
        <div className="ow-journey__step">{stepLabel} {index + 1} / {total}</div>
        <div className="ow-journey__status">{status}</div>
      </div>
      {paused ? (
        <div className="ow-journey__next" onClick={() => next()}>
          <span>{last ? "Kết thúc" : "Tiếp"}</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </div>
      ) : (
        <div className="ow-journey__moving"><span />Đang đi…</div>
      )}
    </div>
  );
}
