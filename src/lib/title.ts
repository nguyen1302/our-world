function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Format calendar day/month/year in Vietnam time, so server (UTC) and browser
// (UTC+7) always show the same date — no off-by-one near midnight.
export const VN_TZ = "Asia/Ho_Chi_Minh";
function dmy(d: Date): { day: number; month: number; year: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: VN_TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { day: get("day"), month: get("month"), year: get("year") };
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
