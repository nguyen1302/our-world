"use client";
import { useMemo, useState } from "react";
import { useMapStore, type MemoryMarker } from "./mapStore";

const MONTHS = ["Th1","Th2","Th3","Th4","Th5","Th6","Th7","Th8","Th9","Th10","Th11","Th12"];

interface Node {
  year: number;
  months: Map<number, Map<number, MemoryMarker[]>>;
}

function buildTree(memories: MemoryMarker[]): Node[] {
  const years = new Map<number, Map<number, Map<number, MemoryMarker[]>>>();
  for (const m of memories) {
    const d = new Date(m.startAt);
    const y = d.getFullYear(), mo = d.getMonth(), day = d.getDate();
    if (!years.has(y)) years.set(y, new Map());
    const ym = years.get(y)!;
    if (!ym.has(mo)) ym.set(mo, new Map());
    const md = ym.get(mo)!;
    if (!md.has(day)) md.set(day, []);
    md.get(day)!.push(m);
  }
  return [...years.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({ year, months }));
}

export default function Timeline() {
  const memories = useMapStore((s) => s.memories);
  const selectedId = useMapStore((s) => s.selectedId);
  const select = useMapStore((s) => s.select);
  const tree = useMemo(() => buildTree(memories), [memories]);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  if (memories.length === 0) return <p className="ow-empty">Chưa có kỷ niệm nào. Hãy import ảnh.</p>;

  return (
    <div className="ow-timeline">
      {tree.map((yn) => {
        const yk = `y${yn.year}`;
        const yOpen = open[yk] ?? true;
        return (
          <div key={yk} className="ow-tl-year">
            <button className="ow-tl-row ow-tl-row--year" onClick={() => toggle(yk)}>
              {yOpen ? "▾" : "▸"} {yn.year}
            </button>
            {yOpen &&
              [...yn.months.entries()].sort((a, b) => b[0] - a[0]).map(([mo, days]) => {
                const mk = `${yk}m${mo}`;
                const mOpen = open[mk] ?? true;
                return (
                  <div key={mk} className="ow-tl-month">
                    <button className="ow-tl-row ow-tl-row--month" onClick={() => toggle(mk)}>
                      {mOpen ? "▾" : "▸"} {MONTHS[mo]}
                    </button>
                    {mOpen &&
                      [...days.entries()].sort((a, b) => b[0] - a[0]).map(([day, mems]) => (
                        <div key={`${mk}d${day}`} className="ow-tl-day">
                          <div className="ow-tl-row ow-tl-row--day">{day}</div>
                          {mems.map((m) => (
                            <button
                              key={m.id}
                              className={`ow-tl-row ow-tl-mem ${m.id === selectedId ? "ow-tl-mem--active" : ""}`}
                              onClick={() => select(m.id)}
                            >
                              {m.title} <span className="ow-tl-count">{m.photoCount}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
