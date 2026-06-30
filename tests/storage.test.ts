import { describe, it, expect } from "vitest";
import { originalKey, thumbKey, extForContentType } from "@/lib/storage";

describe("storage keys", () => {
  it("maps content types to extensions", () => {
    expect(extForContentType("image/jpeg")).toBe("jpg");
    expect(extForContentType("image/png")).toBe("png");
    expect(extForContentType("image/heic")).toBe("heic");
    expect(extForContentType("application/zip")).toBe("bin");
  });

  it("builds original key with space prefix and ext", () => {
    expect(originalKey("space1", "abc", "image/jpeg")).toBe("originals/space1/abc.jpg");
  });

  it("builds thumb key as webp", () => {
    expect(thumbKey("space1", "abc")).toBe("thumbs/space1/abc.webp");
  });
});
