function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function dmy(d: Date): { day: number; month: number; year: number } {
  return { day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() };
}

export function formatDateRange(startAt: Date, endAt: Date): string {
  const s = dmy(startAt);
  const e = dmy(endAt);
  if (s.day === e.day && s.month === e.month && s.year === e.year) {
    return `${pad(s.day)}/${pad(s.month)}/${s.year}`;
  }
  if (s.month === e.month && s.year === e.year) {
    return `${pad(s.day)}–${pad(e.day)}/${pad(e.month)}/${e.year}`;
  }
  return `${pad(s.day)}/${pad(s.month)}/${s.year} – ${pad(e.day)}/${pad(e.month)}/${e.year}`;
}

export interface TitleInput {
  placeName?: string | null;
  city?: string | null;
  startAt: Date;
  endAt: Date;
}

export function buildTitle(input: TitleInput): string {
  const place = (input.placeName || input.city || "").trim();
  const range = formatDateRange(input.startAt, input.endAt);
  if (place) return `${place} · ${range}`;
  return range;
}
