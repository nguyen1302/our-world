"use client";
import { useJourney } from "./journeyStore";
import { useMapStore } from "./mapStore";

export default function JourneyControls() {
  const playing = useJourney((s) => s.playing);
  const phase = useJourney((s) => s.phase);
  const index = useJourney((s) => s.index);
  const total = useJourney((s) => s.total);
  const next = useJourney((s) => s.next);
  const exit = useJourney((s) => s.exit);
  const closeDetail = useMapStore((s) => s.closeDetail);

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
      <span className="ow-journey__count">
        {index + 1} / {total}
      </span>
      <button className="ow-journey__next" disabled={phase === "moving"} onClick={() => next()}>
        {phase === "moving" ? "Đang đi…" : last ? "✓ Kết thúc" : "Tiếp →"}
      </button>
    </div>
  );
}
