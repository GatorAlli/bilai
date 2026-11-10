import { describe, expect, it } from "vitest";
import { normalizeBdPhone } from "./phone";


describe("normalizeBdPhone: accepts", () => {
  it.each([
    ["01712345678", "8801712345678"],
    ["+8801712345678", "8801712345678"],
    ["8801712345678", "8801712345678"],
    ["  017-1234 5678 ", "8801712345678"],
    ["+88 01712 345678", "8801712345678"],
    ["+880 (1712) 345678", "8801712345678"],
    ["01312345678", "8801312345678"],
    ["01912345678", "8801912345678"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeBdPhone(input)).toBe(expected);
  });

  it("is idempotent (normalizing twice gives the same result)", () => {
    const once = normalizeBdPhone("01712345678")!;
    expect(normalizeBdPhone(once)).toBe(once);
  });
});

describe("normalizeBdPhone: rejects", () => {
  it.each([
    "",
    "   ",
    "abc",
    "0171234567", // too short
    "017123456789", // too long
    "01212345678", // 012 is not a mobile prefix
    "01012345678",
    "1712345678", // no leading 0 or 880
    "+8801212345678",
    "+919876543210", // Indian number
    "88001712345678", // extra 0 after 880
    "017+12345678",
    "0171234567a",
  ])("%j", (input) => {
    expect(normalizeBdPhone(input)).toBeNull();
  });
});