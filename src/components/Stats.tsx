"use client";
import { useMapStore } from "./mapStore";

export default function Stats() {
  const stats = useMapStore((s) => s.stats);
  if (!stats) return null;
  const items: { n: number; l: string }[] = [
    { n: stats.memories, l: "kỷ niệm" },
    { n: stats.provinces, l: "tỉnh thành" },
    { n: stats.photos, l: "ảnh" },
  ];
  return (
    <div className="ow-stats">
      {items.map((it) => (
        <div className="ow-stat" key={it.l}>
          <div className="ow-stat__n">{it.n}</div>
          <div className="ow-stat__l">{it.l}</div>
        </div>
      ))}
    </div>
  );
}
