"use client";
import { useMapStore } from "./mapStore";

export default function Stats() {
  const stats = useMapStore((s) => s.stats);
  if (!stats) return null;
  const items: { icon: string; label: string; n: number }[] = [
    { icon: "💛", label: "Kỷ niệm", n: stats.memories },
    { icon: "🖼️", label: "Ảnh", n: stats.photos },
    { icon: "📍", label: "Tỉnh/thành", n: stats.provinces },
    { icon: "🌏", label: "Quốc gia", n: stats.countries },
  ];
  return (
    <div className="ow-stats">
      {items.map((it) => (
        <div className="ow-stat" key={it.label} title={it.label}>
          <span className="ow-stat__i">{it.icon}</span>
          <span className="ow-stat__n">{it.n}</span>
          <span className="ow-stat__l">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
