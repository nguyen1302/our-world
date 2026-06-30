"use client";
import { useMapStore } from "./mapStore";

export default function OnThisDay() {
  const memories = useMapStore((s) => s.memories);
  const select = useMapStore((s) => s.select);

  const today = new Date();
  const matches = memories.filter((m) => {
    const d = new Date(m.startAt);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  });

  if (matches.length === 0) return null;

  return (
    <div className="ow-onthisday">
      <strong>On This Day</strong>
      {matches.map((m) => {
        const years = today.getFullYear() - new Date(m.startAt).getFullYear();
        return (
          <button key={m.id} className="ow-onthisday__item" onClick={() => select(m.id)}>
            {m.title}
            {years > 0 ? <em> · {years} năm trước</em> : <em> · hôm nay</em>}
          </button>
        );
      })}
    </div>
  );
}
