import type { Faces } from "./journeyStore";

export type VehicleType = "bike" | "car" | "plane";

function faceMarkup(face: string | null, cx: number, cy: number, r: number, id: string): string {
  if (face) {
    return (
      `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>` +
      `<image href="${face}" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" ` +
      `clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>` +
      `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#fff" stroke-width="2"/>`
    );
  }
  // default cute face
  const eyeY = cy - r * 0.15;
  return (
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffe0b2" stroke="#fff" stroke-width="2"/>` +
    `<circle cx="${cx - r * 0.35}" cy="${eyeY}" r="${r * 0.13}" fill="#5b4636"/>` +
    `<circle cx="${cx + r * 0.35}" cy="${eyeY}" r="${r * 0.13}" fill="#5b4636"/>` +
    `<path d="M ${cx - r * 0.4} ${cy + r * 0.25} Q ${cx} ${cy + r * 0.6} ${cx + r * 0.4} ${cy + r * 0.25}" ` +
    `stroke="#c1694f" stroke-width="${r * 0.16}" fill="none" stroke-linecap="round"/>`
  );
}

function body(type: VehicleType, faces: Faces, id: string): string {
  const fa = (cx: number, cy: number, r: number) => faceMarkup(faces.a, cx, cy, r, `${id}a`);
  const fb = (cx: number, cy: number, r: number) => faceMarkup(faces.b, cx, cy, r, `${id}b`);

  if (type === "bike") {
    return (
      `<circle cx="18" cy="37" r="7.5" fill="#2b2f36"/><circle cx="18" cy="37" r="3" fill="#9aa4b2"/>` +
      `<circle cx="54" cy="37" r="7.5" fill="#2b2f36"/><circle cx="54" cy="37" r="3" fill="#9aa4b2"/>` +
      `<path d="M18 37 L32 26 L50 26 L54 37" stroke="#e0a13c" stroke-width="4.5" fill="none" stroke-linecap="round"/>` +
      `<rect x="28" y="24" width="22" height="5" rx="2.5" fill="#2d6cdf"/>` +
      `<path d="M50 26 L59 19" stroke="#2b2f36" stroke-width="2.5" stroke-linecap="round"/>` +
      fb(40, 13, 9) +
      fa(27, 15, 9)
    );
  }
  if (type === "car") {
    return (
      `<circle cx="20" cy="38" r="6.5" fill="#2b2f36"/><circle cx="20" cy="38" r="2.6" fill="#9aa4b2"/>` +
      `<circle cx="52" cy="38" r="6.5" fill="#2b2f36"/><circle cx="52" cy="38" r="2.6" fill="#9aa4b2"/>` +
      `<rect x="8" y="24" width="56" height="14" rx="6" fill="#2d6cdf"/>` +
      `<path d="M16 25 Q22 11 36 11 L48 11 Q58 12 60 25 Z" fill="#5b8def"/>` +
      `<rect x="35" y="12" width="2" height="13" fill="#2d6cdf"/>` +
      fa(27, 18, 8) +
      fb(46, 18, 8)
    );
  }
  // plane
  return (
    `<path d="M60 22 L72 11 L67 23 Z" fill="#2d6cdf"/>` +
    `<ellipse cx="34" cy="23" rx="30" ry="9" fill="#eef2f8" stroke="#cdd7e6" stroke-width="1.5"/>` +
    `<path d="M30 26 L22 40 L42 28 Z" fill="#5b8def"/>` +
    `<path d="M52 18 L60 8 L58 20 Z" fill="#9bbdf0"/>` +
    fa(27, 21, 6.5) +
    fb(44, 21, 6.5)
  );
}

/** SVG markup string for a vehicle, usable as Leaflet divIcon html or innerHTML. */
export function vehicleSvg(
  type: VehicleType,
  faces: Faces,
  opts: { flip?: boolean; size?: number; id?: string } = {},
): string {
  const size = opts.size ?? 72;
  const h = Math.round((size * 46) / 72);
  const id = opts.id ?? "v";
  const inner = body(type, faces, id);
  const content = opts.flip ? `<g transform="translate(72,0) scale(-1,1)">${inner}</g>` : inner;
  return (
    `<svg width="${size}" height="${h}" viewBox="0 0 72 46" xmlns="http://www.w3.org/2000/svg" ` +
    `style="overflow:visible;filter:drop-shadow(0 3px 4px rgba(15,23,42,.35))">${content}</svg>`
  );
}
