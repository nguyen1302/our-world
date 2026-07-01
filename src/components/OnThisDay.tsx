"use client";
import { useMapStore } from "./mapStore";

export default function OnThisDay() {
  const memories = useMapStore((s) => s.memories);
  const requestEnterTrip = useMapStore((s) => s.requestEnterTrip);

  const today = new Date();
  const mmdd = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const match = memories
    .filter((m) => m.startAt.slice(5, 10) === mmdd && Number(m.startAt.slice(0, 4)) < today.getFullYear())
    .sort((a, b) => a.startAt.localeCompare(b.startAt))[0];

  if (!match) return null;
  const years = today.getFullYear() - Number(match.startAt.slice(0, 4));
  const label = `${years} năm trước · ${match.city ?? ""}`;

  return (
    <div className="ow-otd" onClick={() => requestEnterTrip(match.id)}>
      <div className="ow-otd__dot" />
      <div>
        <div className="ow-otd__k">Ngày này</div>
        <div className="ow-otd__v">{label}</div>
      </div>
    </div>
  );
}
