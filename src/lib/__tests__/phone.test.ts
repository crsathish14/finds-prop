import { describe, expect, it } from "vitest";
import { normaliseIndianMobile, phoneDigits } from "../phone";

describe("normaliseIndianMobile", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["(+91) 9876543210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
    ["6000000000", "+916000000000"],
  ])("%s becomes %s", (input, expected) => {
    expect(normaliseIndianMobile(input)).toBe(expected);
  });

  it.each([
    "",
    "12345",
    "5876543210", // Indian mobile numbers start with 6, 7, 8 or 9
    "98765432101", // eleven digits
    "+14155552671", // a US number is refused (FR-AUTH-09)
    "+44 7911 123456",
    "phone",
  ])("refuses %s", (input) => {
    expect(normaliseIndianMobile(input)).toBeNull();
  });

  it("keeps only digits", () => {
    expect(phoneDigits("+91 (98765) 43-210")).toBe("919876543210");
  });
});
