"use client";
import { useEffect, useMemo, useState } from "react";
import { useJourney } from "./journeyStore";
import { useMapStore } from "./mapStore";
import { startMusic, stopMusic, setMusicMuted, isMusicMuted } from "./journeyMusic";

export default function JourneyControls() {
  const playing = useJourney((s) => s.playing);
  const phase = useJourney((s) => s.phase);
  const index = useJourney((s) => s.index);
  const total = useJourney((s) => s.total);
  const next = useJourney((s) => s.next);
  const exit = useJourney((s) => s.exit);
  const closeDetail = useMapStore((s) => s.closeDetail);
  const memories = useMapStore((s) => s.memories);
  const [muted, setMuted] = useState(isMusicMuted());

  const ord = useMemo(() => [...memories].sort((a, b) => a.startAt.localeCompare(b.startAt)), [memories]);

  useEffect(() => {
    if (playing) startMusic();
    else stopMusic();
    return () => stopMusic();
  }, [playing]);

  if (!playing) return null;
  const last = index >= total - 1;
  const paused = phase === "paused";
  const cur = ord[index];
  const nextStop = ord[index + 1];
  const status = paused ? cur?.title ?? "" : `Đang đến ${nextStop?.title ?? ""}`;

  return (
    <div className="ow-journey">
      <div className="ow-journey__exit" onClick={() => { exit(); closeDetail(); }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        Thoát
      </div>
      <div className="ow-journey__mute" onClick={() => { const m = !muted; setMuted(m); setMusicMuted(m); }} title={muted ? "Bật nhạc" : "Tắt nhạc"}>
        {muted ? "🔇" : "🎵"}
      </div>
      <div className="ow-journey__center">
        <div className="ow-journey__step">Chặng {index + 1} / {total}</div>
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
