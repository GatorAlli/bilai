import { describe, expect, it } from "vitest";
import { isPublicId, newPublicId } from "./public-id";

describe("newPublicId", () => {
  it("makes 8 lowercase letters and digits", () => {
    for (let i = 0; i < 200; i++) {
      expect(newPublicId()).toMatch(/^[a-z0-9]{8}$/);
    }
  });

  it("doesn't repeat itself", () => {
    const ids = new Set(Array.from({ length: 1000 }, newPublicId));
    expect(ids.size).toBe(1000);
  });
});

describe("isPublicId", () => {
  it("accepts valid ids", () => {
    expect(isPublicId("gj34jfxk")).toBe(true);
    expect(isPublicId("00000000")).toBe(true);
  });

  it("rejects everything else", () => {
    for (const value of [
      "",
      "gj34jfx",
      "gj34jfxkk",
      "GJ34JFXK",
      "gj34-fxk",
      "../../../",
      "12",
      12345678,
      null,
      undefined,
    ]) {
      expect(isPublicId(value)).toBe(false);
    }
  });
});
