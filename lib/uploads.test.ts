import { afterEach, describe, expect, it, vi } from "vitest";
import { catPhotoKey, catPhotoUrl, isCatPhotoKey, isWebp } from "./uploads";

afterEach(() => vi.unstubAllEnvs());

describe("catPhotoKey / isCatPhotoKey", () => {
  it("builds keys the checker accepts", () => {
    for (let n = 1; n <= 5; n++) {
      expect(isCatPhotoKey(catPhotoKey("gj34jfxk", n))).toBe(true);
    }
    expect(catPhotoKey("gj34jfxk", 1)).toBe("cats/gj34jfxk-1.webp");
  });

  it("rejects anything else", () => {
    for (const key of [
      "cats/gj34jfxk-0.webp",
      "cats/gj34jfxk-6.webp",
      "cats/gj34jfx-1.webp",
      "cats/GJ34JFXK-1.webp",
      "cats/gj34jfxk-1.png",
      "cats/../gj34jfxk-1.webp",
      "gj34jfxk-1.webp",
      "user/1b2c.webp",
    ]) {
      expect(isCatPhotoKey(key)).toBe(false);
    }
  });
});

describe("catPhotoUrl", () => {
  it("joins the public R2 domain and key", () => {
    vi.stubEnv("R2_PUBLIC_URL", "https://img.example.com/");
    expect(catPhotoUrl("cats/gj34jfxk-2.webp")).toBe(
      "https://img.example.com/cats/gj34jfxk-2.webp",
    );
  });

  it("fails loudly without R2_PUBLIC_URL", () => {
    vi.stubEnv("R2_PUBLIC_URL", "");
    expect(() => catPhotoUrl("cats/gj34jfxk-1.webp")).toThrow(/R2_PUBLIC_URL/);
  });
});

describe("isWebp", () => {
  it("checks the RIFF/WEBP header", () => {
    expect(isWebp(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe(true);
    expect(isWebp(Buffer.from("\x89PNG\r\n\x1a\n0000000"))).toBe(false);
  });
});
