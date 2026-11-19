import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_LOGIN, loginUrl, safeNext } from "./auth-redirect";

describe("safeNext", () => {
  it("accepts same-site paths, with query strings", () => {
    expect(safeNext("/find_a_cat/3")).toBe("/find_a_cat/3");
    expect(safeNext("/find_a_cat?district=Dhaka")).toBe(
      "/find_a_cat?district=Dhaka",
    );
  });

  it("falls back when missing", () => {
    expect(safeNext(undefined)).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNext("")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNext(null, "/x")).toBe("/x");
  });

  it("rejects other origins and tricks", () => {
    for (const bad of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "javascript:alert(1)",
      "evil.com",
      "/a\nb",
    ]) {
      expect(safeNext(bad)).toBe(DEFAULT_AFTER_LOGIN);
    }
  });

  it("rejects the login page itself", () => {
    expect(safeNext("/auth")).toBe(DEFAULT_AFTER_LOGIN);
    expect(safeNext("/auth?next=/x")).toBe(DEFAULT_AFTER_LOGIN);
  });

  it("uses the first value of a repeated parameter", () => {
    expect(safeNext(["/profile", "https://evil.com"])).toBe("/profile");
  });
});

describe("loginUrl", () => {
  it("encodes the destination", () => {
    expect(loginUrl("/find_a_cat/3?x=1")).toBe(
      "/auth?next=%2Ffind_a_cat%2F3%3Fx%3D1",
    );
  });

  it("is plain /auth for unsafe or login paths", () => {
    expect(loginUrl("/auth")).toBe("/auth");
    expect(loginUrl("https://evil.com")).toBe("/auth");
  });
});
