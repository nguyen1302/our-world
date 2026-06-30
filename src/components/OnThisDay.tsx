"use client";
import { useMapStore } from "./mapStore";

export default function OnThisDay() {
  const memories = useMapStore((s) => s.memories);
  const select = useMapStore((s) => s.select);

  const today = new Date();
  // Same day-of-year, but only in PAST years ("X năm trước").
  const matches = memories.filter((m) => {
    const d = new Date(m.startAt);
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() < today.getFullYear()
    );
  });

  if (matches.length === 0) return null;

  return (
    <div className="ow-onthisday">
      <span className="ow-onthisday__badge">On This Day ♥</span>
      {matches.map((m) => {
        const years = today.getFullYear() - new Date(m.startAt).getFullYear();
        return (
          <button key={m.id} className="ow-onthisday__item" onClick={() => select(m.id)}>
            <strong>{m.title}</strong>
            <em>{years} năm trước</em>
          </button>
        );
      })}
    </div>
  );
}
