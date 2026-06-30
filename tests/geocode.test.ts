import { describe, it, expect } from "vitest";
import { resolveProvinceCode, normalizeProvince, slugify } from "@/lib/provinces";
import { cellKey, parseNominatim } from "@/lib/geocode";

describe("province resolution", () => {
  it("matches with diacritics", () => {
    expect(resolveProvinceCode("Lâm Đồng")).toBe("lam-dong");
  });
  it("matches without diacritics", () => {
    expect(resolveProvinceCode("Lam Dong")).toBe("lam-dong");
  });
  it("strips admin words", () => {
    expect(resolveProvinceCode("Tỉnh Lâm Đồng")).toBe("lam-dong");
  });
  it("resolves HCMC aliases", () => {
    expect(resolveProvinceCode("Ho Chi Minh City")).toBe("ho-chi-minh");
    expect(resolveProvinceCode("Thành phố Hồ Chí Minh")).toBe("ho-chi-minh");
  });
  it("returns null for unknown", () => {
    expect(resolveProvinceCode("Tokyo")).toBeNull();
    expect(resolveProvinceCode("")).toBeNull();
    expect(resolveProvinceCode(null)).toBeNull();
  });
  it("slugify is diacritic-free kebab", () => {
    expect(slugify("Đà Nẵng")).toBe("da-nang");
    expect(normalizeProvince("Hà Nội")).toBe("ha noi");
  });
});

describe("cellKey", () => {
  it("rounds to 3 decimals", () => {
    expect(cellKey(11.940123)).toBe("11.940");
    expect(cellKey(108.4509)).toBe("108.451");
  });
});

describe("parseNominatim", () => {
  it("extracts province from state", () => {
    const r = parseNominatim({
      name: "Cafe Tùng",
      address: { state: "Lâm Đồng", city: "Đà Lạt", country: "Việt Nam" },
    });
    expect(r.provinceCode).toBe("lam-dong");
    expect(r.city).toBe("Đà Lạt");
    expect(r.country).toBe("Việt Nam");
    expect(r.placeName).toBe("Cafe Tùng");
  });
});
