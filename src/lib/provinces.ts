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

/**
 * Normalize a place name for matching: lowercase, no diacritics. Strips admin
 * markers ONLY as a leading Vietnamese prefix ("Tỉnh"/"Thành phố"/"TP") or a
 * trailing English word ("City"/"Province") — never mid-name, so "Hà Tĩnh"
 * (whose "Tĩnh" diacritic-strips to "tinh") is preserved intact.
 */
export function normalizeProvince(name: string): string {
  return stripDiacritics(name)
    .toLowerCase()
    .replace(/^(tinh|thanh pho|tp)\s+/, "")
    .replace(/\s+(city|province)$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// ISO 3166-2:VN code -> province slug (derived from public/vn-provinces.geojson,
// so codes always match the Scratch Map polygons). Authoritative when Nominatim
// returns an ISO code, which is more reliable than the free-text state field.
const ISO_TO_CODE: Record<string, string> = {"VN-44":"an-giang","VN-43":"con-dao","VN-54":"bac-giang","VN-53":"bac-kan","VN-55":"bac-lieu","VN-56":"bac-ninh","VN-50":"ben-tre","VN-31":"binh-dinh","VN-57":"binh-duong","VN-58":"binh-phuoc","VN-40":"binh-thuan","VN-59":"ca-mau","VN-CT":"can-tho","VN-04":"cao-bang","VN-DN":"da-nang","VN-33":"dak-lak","VN-72":"dak-nong","VN-71":"dien-bien","VN-39":"dong-nai","VN-45":"dong-thap","VN-30":"gia-lai","VN-03":"ha-giang","VN-63":"ha-nam","VN-HN":"ha-noi","VN-23":"ha-tinh","VN-61":"hai-duong","VN-HP":"hai-phong","VN-73":"hau-giang","VN-SG":"ho-chi-minh","VN-14":"hoa-binh","VN-66":"hung-yen","VN-34":"khanh-hoa","VN-47":"kien-giang","VN-28":"kon-tum","VN-01":"lai-chau","VN-35":"lam-dong","VN-09":"lang-son","VN-02":"lao-cai","VN-41":"long-an","VN-67":"nam-dinh","VN-22":"nghe-an","VN-18":"ninh-binh","VN-36":"ninh-thuan","VN-68":"phu-tho","VN-32":"phu-yen","VN-24":"quang-binh","VN-27":"quang-nam","VN-29":"quang-ngai","VN-13":"quang-ninh","VN-25":"quang-tri","VN-52":"soc-trang","VN-05":"son-la","VN-37":"tay-ninh","VN-20":"thai-binh","VN-69":"thai-nguyen","VN-21":"thanh-hoa","VN-26":"thua-thien-hue","VN-46":"tien-giang","VN-51":"tra-vinh","VN-07":"tuyen-quang","VN-49":"vinh-long","VN-70":"vinh-phuc","VN-06":"yen-bai"};

export function resolveProvinceFromIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return ISO_TO_CODE[iso.toUpperCase()] ?? null;
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
