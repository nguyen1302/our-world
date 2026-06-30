"use client";
import { useMemo, useRef } from "react";
import { useMapStore } from "./mapStore";

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

export default function TimelineBar() {
  const memories = useMapStore((s) => s.memories);
  const previewId = useMapStore((s) => s.previewId);
  const preview = useMapStore((s) => s.preview);
  const trackRef = useRef<HTMLDivElement>(null);

  // Sorted oldest -> newest, with a year label inserted when the year changes.
  const items = useMemo(() => {
    const sorted = [...memories].sort((a, b) => a.startAt.localeCompare(b.startAt));
    let lastYear: number | null = null;
    return sorted.map((m) => {
      const d = new Date(m.startAt);
      const year = d.getFullYear();
      const showYear = year !== lastYear;
      lastYear = year;
      return { m, year, day: d.getDate(), month: d.getMonth(), showYear };
    });
  }, [memories]);

  if (memories.length === 0) {
    return (
      <div className="ow-tlbar ow-tlbar--empty">Chưa có kỷ niệm nào — hãy Import ảnh ♥</div>
    );
  }

  return (
    <div className="ow-tlbar">
      <div className="ow-tlbar__track" ref={trackRef}>
        {items.map(({ m, year, day, month, showYear }) => (
          <div className="ow-tlnode-wrap" key={m.id}>
            {showYear && <span className="ow-tlyear">{year}</span>}
            <button
              className={`ow-tlnode ${m.id === previewId ? "ow-tlnode--active" : ""}`}
              onClick={() => preview(m.id)}
              title={m.title}
            >
              <span className="ow-tlnode__dot" />
              <span className="ow-tlnode__labels">
                <span className="ow-tlnode__date">
                  {day}/{MONTHS[month]}
                </span>
                <span className="ow-tlnode__title">{m.title.split(" · ")[0]}</span>
              </span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
