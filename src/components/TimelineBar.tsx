"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMapStore } from "./mapStore";
import { useJourney, vehicleForDistance, haversineKm } from "./journeyStore";
import { vehicleSvg, type VehicleType } from "./vehicles";

const MONTHS = ["01","02","03","04","05","06","07","08","09","10","11","12"];

export default function TimelineBar() {
  const memories = useMapStore((s) => s.memories);
  const previewId = useMapStore((s) => s.previewId);
  const preview = useMapStore((s) => s.preview);
  const trackRef = useRef<HTMLDivElement>(null);
  const nodeEls = useRef<(HTMLButtonElement | null)[]>([]);

  const playing = useJourney((s) => s.playing);
  const phase = useJourney((s) => s.phase);
  const jIndex = useJourney((s) => s.index);
  const progress = useJourney((s) => s.progress);
  const faces = useJourney((s) => s.faces);

  const [veh, setVeh] = useState<{ left: number; type: VehicleType; flip: boolean; show: boolean }>({
    left: 0,
    type: "bike",
    flip: false,
    show: false,
  });

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

  const sorted = useMemo(() => [...memories].sort((a, b) => a.startAt.localeCompare(b.startAt)), [memories]);

  useEffect(() => {
    const track = trackRef.current;
    if (!playing || !track) {
      setVeh((v) => (v.show ? { ...v, show: false } : v));
      return;
    }
    const centerOf = (i: number) => {
      const el = nodeEls.current[i];
      return el ? el.offsetLeft + el.offsetWidth / 2 : null;
    };
    let cx: number | null;
    let type: VehicleType = "bike";
    let flip = false;
    if (phase === "paused") {
      cx = centerOf(jIndex);
      const a = sorted[jIndex - 1];
      const b = sorted[jIndex];
      if (a && b) type = vehicleForDistance(haversineKm(a, b));
    } else {
      const a = centerOf(jIndex);
      const b = centerOf(jIndex + 1);
      if (a == null || b == null) return;
      cx = a + (b - a) * progress;
      const ma = sorted[jIndex];
      const mb = sorted[jIndex + 1];
      if (ma && mb) {
        type = vehicleForDistance(haversineKm(ma, mb));
        flip = mb.lng < ma.lng;
      }
    }
    if (cx == null) return;
    // keep the vehicle in view
    track.scrollLeft = cx - track.clientWidth / 2;
    setVeh({ left: cx - track.scrollLeft, type, flip, show: true });
  }, [playing, phase, jIndex, progress, sorted, faces]);

  if (memories.length === 0) {
    return (
      <div className="ow-tlbar ow-tlbar--empty">Chưa có kỷ niệm nào — hãy Import ảnh ♥</div>
    );
  }

  return (
    <div className="ow-tlbar">
      <div className="ow-tlbar__track" ref={trackRef}>
        {items.map(({ m, year, day, month, showYear }, i) => (
          <div className="ow-tlnode-wrap" key={m.id}>
            {showYear && <span className="ow-tlyear">{year}</span>}
            <button
              ref={(el) => {
                nodeEls.current[i] = el;
              }}
              className={`ow-tlnode ${m.id === previewId ? "ow-tlnode--active" : ""}`}
              onClick={() => preview(m.id)}
              title={m.title}
            >
              <span
                className={`ow-tlnode__thumb ${m.coverThumbUrl ? "" : "ow-tlnode__thumb--empty"}`}
                style={m.coverThumbUrl ? { backgroundImage: `url('${m.coverThumbUrl}')` } : undefined}
              />
              <span className="ow-tlnode__labels">
                <span className="ow-tlnode__date">
                  {day}/{MONTHS[month]}
                </span>
                <span className="ow-tlnode__title">{m.title.split(" · ")[0]}</span>
              </span>
            </button>
          </div>
        ))}
        {veh.show && (
          <div
            className="ow-tlvehicle"
            style={{ left: veh.left }}
            dangerouslySetInnerHTML={{ __html: vehicleSvg(veh.type, faces, { flip: veh.flip, size: 50, id: "tlv" }) }}
          />
        )}
      </div>
    </div>
  );
}
