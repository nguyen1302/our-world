import type { Faces } from "./journeyStore";

export type VehicleType = "bike" | "car" | "plane";

const GOLD = "#e9b872";
const ROSE = "#d98695";
const CREAM = "#f7efe6";
const DARK = "#3a2e27";
const WHEEL = "#241d18";
const GLASS = "#bbe5ec";

// Drawn cute face (variant 0 = lock of hair, 1 = bow) — used when no photo set.
function cuteFace(cx: number, cy: number, r: number, v: number): string {
  const sx = r * 0.42;
  const eyeY = cy - 1;
  const extra =
    v === 0
      ? `<path d="M${cx - 2.4} ${cy - r + 0.4} q2.4 -3 4.8 0" fill="none" stroke="#5A4636" stroke-width="1.5" stroke-linecap="round"/>`
      : `<path d="M${cx + r * 0.55} ${cy - r * 0.72} l2.6 -1.4 -0.6 2.9 z" fill="${ROSE}"/><circle cx="${cx + r * 0.62}" cy="${cy - r * 0.6}" r="0.9" fill="${ROSE}"/>`;
  return `<g>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#F6D2B8" stroke="#fff" stroke-width="1.3"/>
    <circle cx="${cx - sx}" cy="${eyeY}" r="1" fill="#3A2E27"/>
    <circle cx="${cx + sx}" cy="${eyeY}" r="1" fill="#3A2E27"/>
    <path d="M${cx - 2} ${cy + 1.7} q2 2 4 0" fill="none" stroke="#3A2E27" stroke-width="1" stroke-linecap="round"/>
    <circle cx="${cx - sx - 1}" cy="${cy + 1.7}" r="1.1" fill="#E79A86" opacity="0.6"/>
    <circle cx="${cx + sx + 1}" cy="${cy + 1.7}" r="1.1" fill="#E79A86" opacity="0.6"/>
    ${extra}</g>`;
}

// Photo face composited into the slot, or the drawn cute face as fallback.
function face(faceUrl: string | null, cx: number, cy: number, r: number, v: number, id: string): string {
  if (!faceUrl) return cuteFace(cx, cy, r, v);
  return (
    `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>` +
    `<image href="${faceUrl}" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="1.3"/>`
  );
}

function bodyFor(type: VehicleType, faces: Faces, id: string): string {
  const fa = (cx: number, cy: number, r: number) => face(faces.a, cx, cy, r, 0, `${id}a`);
  const fb = (cx: number, cy: number, r: number) => face(faces.b, cx, cy, r, 1, `${id}b`);

  if (type === "bike") {
    return `
      <circle cx="16" cy="37" r="7" fill="${WHEEL}"/><circle cx="16" cy="37" r="2.6" fill="${CREAM}"/>
      <circle cx="58" cy="37" r="7" fill="${WHEEL}"/><circle cx="58" cy="37" r="2.6" fill="${CREAM}"/>
      <rect x="16" y="32" width="40" height="5" rx="2.5" fill="${DARK}"/>
      <rect x="50" y="14" width="8" height="20" rx="3" fill="${GOLD}"/>
      <path d="M56 16 L65 11" stroke="${DARK}" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="20" y="25" width="24" height="6" rx="3" fill="${ROSE}"/>
      <rect x="22" y="17" width="9" height="11" rx="4.5" fill="${GOLD}"/>
      <rect x="37" y="14" width="9" height="13" rx="4.5" fill="${ROSE}"/>
      <rect x="10" y="33" width="8" height="3" rx="1.5" fill="#6b5a4a"/>
      ${fa(26, 14, 6.4)} ${fb(44, 11, 6.4)}`;
  }
  if (type === "car") {
    return `
      <path d="M16 21 Q19 8 30 8 H43 Q54 8 57 21 Z" fill="${GOLD}"/>
      <rect x="6" y="20" width="60" height="14" rx="6" fill="${GOLD}"/>
      <rect x="6" y="29" width="60" height="5" rx="2.5" fill="${ROSE}"/>
      <circle cx="27" cy="16" r="7" fill="${GLASS}"/><circle cx="45" cy="16" r="7" fill="${GLASS}"/>
      <circle cx="20" cy="35" r="6.2" fill="${WHEEL}"/><circle cx="20" cy="35" r="2.3" fill="${CREAM}"/>
      <circle cx="52" cy="35" r="6.2" fill="${WHEEL}"/><circle cx="52" cy="35" r="2.3" fill="${CREAM}"/>
      <circle cx="64" cy="26" r="2.1" fill="#FFE9A8"/>
      <rect x="5" y="31" width="7" height="3" rx="1.5" fill="#6b5a4a"/>
      ${fa(27, 16, 6)} ${fb(45, 16, 6)}`;
  }
  // plane
  return `
    <path d="M10 16 L3 4 L17 15 Z" fill="${ROSE}"/>
    <rect x="8" y="15" width="54" height="17" rx="8.5" fill="${CREAM}"/>
    <path d="M9 31 Q34 33 60 31 L60 25 Q34 27 9 25 Z" fill="#E4D9C8"/>
    <path d="M27 31 L47 31 L41 40 L33 40 Z" fill="${GOLD}"/>
    <rect x="9" y="22" width="52" height="3.4" rx="1.7" fill="${ROSE}"/>
    <path d="M55 16 Q62 17 61 24 L55 24 Z" fill="${GLASS}"/>
    <circle cx="30" cy="22" r="5.4" fill="${GLASS}"/><circle cx="44" cy="22" r="5.4" fill="${GLASS}"/>
    ${fa(30, 22, 5.2)} ${fb(44, 22, 5.2)}`;
}

/** SVG markup for a cute vehicle, usable as Leaflet divIcon html or innerHTML. */
export function vehicleSvg(
  type: VehicleType,
  faces: Faces,
  opts: { flip?: boolean; size?: number; id?: string } = {},
): string {
  const id = opts.id ?? "v";
  const inner = bodyFor(type, faces, id);
  const shadow = `<ellipse cx="36" cy="44" rx="30" ry="2.6" fill="rgba(0,0,0,0.18)"/>`;
  return `<svg viewBox="0 0 72 46" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">${shadow}${inner}</svg>`;
}
