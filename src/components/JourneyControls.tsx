"use client";
import { useEffect, useState } from "react";
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
  const [muted, setMuted] = useState(isMusicMuted());

  useEffect(() => {
    if (playing) startMusic();
    else stopMusic();
    return () => stopMusic();
  }, [playing]);

  if (!playing) return null;
  const last = index >= total - 1;

  return (
    <div className="ow-journey">
      <button
        className="ow-journey__exit"
        onClick={() => {
          exit();
          closeDetail();
        }}
      >
        ✕ Thoát
      </button>
      <button
        className="ow-journey__mute"
        title={muted ? "Bật nhạc" : "Tắt nhạc"}
        onClick={() => {
          const m = !muted;
          setMuted(m);
          setMusicMuted(m);
        }}
      >
        {muted ? "🔇" : "🎵"}
      </button>
      <span className="ow-journey__count">
        {index + 1} / {total}
      </span>
      <button className="ow-journey__next" disabled={phase === "moving"} onClick={() => next()}>
        {phase === "moving" ? "Đang đi…" : last ? "✓ Kết thúc" : "Tiếp →"}
      </button>
    </div>
  );
}
