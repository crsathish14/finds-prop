import { describe, expect, it } from "vitest";
import { isSafeRedirectPath, safeRedirectPath } from "@/lib/url/safe-redirect";

describe("UT-safe-redirect (BR-06)", () => {
  it.each([
    "/",
    "/dashboard",
    "/x?y=1",
    "/properties/sea-view-ab12cd34?show=24",
    "/projects#units",
    "/properties?q=100%25",
  ])("accepts %s", (path) => {
    expect(isSafeRedirectPath(path)).toBe(true);
    expect(safeRedirectPath(path)).toBe(path);
  });

  it.each([
    ["a protocol-relative address", "//evil.example"],
    ["a backslash host", "/\\evil.example"],
    ["a backslash anywhere", "/a\\b"],
    ["an encoded double slash", "%2F%2Fevil.example"],
    ["a double slash hidden after a slash", "/%2F/evil.example"],
    ["an encoded backslash", "/%5Cevil.example"],
    ["a double-encoded double slash", "/%252F%252Fevil.example"],
    ["a full address", "http://evil.example"],
    ["an https address", "https://evil.example/x"],
    ["a script", "javascript:alert(1)"],
    ["an empty value", ""],
    ["no leading slash", "dashboard"],
    ["a new line", "/ok\nLocation: https://evil.example"],
    ["a tab", "/ok\t/x"],
    ["a bad encoding", "/%E0%A4%A"],
    ["a very long value", `/${"a".repeat(600)}`],
  ])("refuses %s", (_label, value) => {
    expect(isSafeRedirectPath(value)).toBe(false);
    expect(safeRedirectPath(value)).toBe("/");
  });

  it("refuses values that are not text", () => {
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
    expect(isSafeRedirectPath(["/x"])).toBe(false);
    expect(isSafeRedirectPath(42)).toBe(false);
  });

  it("uses the fallback it is given", () => {
    expect(safeRedirectPath("//evil.example", "/dashboard")).toBe("/dashboard");
    expect(safeRedirectPath(null, "/dashboard")).toBe("/dashboard");
  });
});
