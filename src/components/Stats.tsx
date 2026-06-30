"use client";
import { useMapStore } from "./mapStore";

export default function Stats() {
  const stats = useMapStore((s) => s.stats);
  if (!stats) return null;
  const items: [string, number][] = [
    ["Kỷ niệm", stats.memories],
    ["Ảnh", stats.photos],
    ["Tỉnh/thành", stats.provinces],
    ["Quốc gia", stats.countries],
  ];
  return (
    <div className="ow-stats">
      {items.map(([label, n]) => (
        <div className="ow-stat" key={label}>
          <span className="ow-stat__n">{n}</span>
          <span className="ow-stat__l">{label}</span>
        </div>
      ))}
    </div>
  );
}
