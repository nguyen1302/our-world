// Canonical Vietnamese province/city names. provinceCode = diacritic-free
// kebab slug of the canonical name. Reverse-geocoded names (often the OSM
// `state` field) are normalized and matched against this list so the Scratch
// Map can color the right polygon. Unknown names resolve to null.

const CANONICAL = [
  "An Giang", "Bà Rịa - Vũng Tàu", "Bắc Giang", "Bắc Kạn", "Bạc Liêu", "Bắc Ninh",
  "Bến Tre", "Bình Định", "Bình Dương", "Bình Phước", "Bình Thuận", "Cà Mau",
  "Cần Thơ", "Cao Bằng", "Đà Nẵng", "Đắk Lắk", "Đắk Nông", "Điện Biên", "Đồng Nai",
  "Đồng Tháp", "Gia Lai", "Hà Giang", "Hà Nam", "Hà Nội", "Hà Tĩnh", "Hải Dương",
  "Hải Phòng", "Hậu Giang", "Hòa Bình", "Hưng Yên", "Khánh Hòa", "Kiên Giang",
  "Kon Tum", "Lai Châu", "Lâm Đồng", "Lạng Sơn", "Lào Cai", "Long An", "Nam Định",
  "Nghệ An", "Ninh Bình", "Ninh Thuận", "Phú Thọ", "Phú Yên", "Quảng Bình",
  "Quảng Nam", "Quảng Ngãi", "Quảng Ninh", "Quảng Trị", "Sóc Trăng", "Sơn La",
  "Tây Ninh", "Thái Bình", "Thái Nguyên", "Thanh Hóa", "Thừa Thiên Huế",
  "Tiền Giang", "Hồ Chí Minh", "Trà Vinh", "Tuyên Quang", "Vĩnh Long",
  "Vĩnh Phúc", "Yên Bái",
];

// Extra aliases mapping a normalized form -> canonical name.
const ALIASES: Record<string, string> = {
  "ho chi minh city": "Hồ Chí Minh",
  "thanh pho ho chi minh": "Hồ Chí Minh",
  "saigon": "Hồ Chí Minh",
  "sai gon": "Hồ Chí Minh",
  "hue": "Thừa Thiên Huế",
  "thua thien - hue": "Thừa Thiên Huế",
  "ba ria vung tau": "Bà Rịa - Vũng Tàu",
  "hanoi": "Hà Nội",
  "da nang city": "Đà Nẵng",
};

export function stripDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

/** Normalize a place name for matching: lowercase, no diacritics, no admin words. */
export function normalizeProvince(name: string): string {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/\b(tinh|thanh pho|tp|city|province|of)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugify(name: string): string {
  return normalizeProvince(name).replace(/\s+/g, "-");
}

const NORMALIZED_TO_CANONICAL = new Map<string, string>();
for (const c of CANONICAL) NORMALIZED_TO_CANONICAL.set(normalizeProvince(c), c);
for (const [alias, canonical] of Object.entries(ALIASES)) {
  NORMALIZED_TO_CANONICAL.set(normalizeProvince(alias), canonical);
}

/** Resolve a (possibly messy) state/city name to a stable province code, or null. */
export function resolveProvinceCode(name: string | null | undefined): string | null {
  if (!name || !name.trim()) return null;
  const canonical = NORMALIZED_TO_CANONICAL.get(normalizeProvince(name));
  return canonical ? slugify(canonical) : null;
}

export const PROVINCE_CODES = CANONICAL.map(slugify);
