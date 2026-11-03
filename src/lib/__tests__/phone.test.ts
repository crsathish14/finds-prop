import { describe, expect, it } from "vitest";
import { classifyPhoneInput, normaliseIndianMobile, phoneDigits } from "../phone";

describe("classifyPhoneInput", () => {
  it.each([
    ["98765 43210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["0091 98765 43210", "+919876543210"],
    ["  +919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
  ])("accepts %s as %s", (input, e164) => {
    expect(classifyPhoneInput(input)).toEqual({ kind: "valid", e164 });
  });

  it.each(["+44 7700 900123", "+14155552671", "0044 7911 123456", "+971 50 123 4567", "+1"])(
    "says %s is a number from another country",
    (input) => {
      expect(classifyPhoneInput(input)).toEqual({ kind: "unsupported" });
    },
  );

  it.each([
    "",
    "phone",
    "98765 4321", // nine digits
    "5876543210", // does not start with 6, 7, 8 or 9
    "98765432101", // eleven digits
    "447911123456", // no "+": cannot be told apart from a mistyped Indian number
    "+91 98765", // an Indian code with too few digits
    "+",
    "00",
  ])("says %s is mistyped, not foreign", (input) => {
    expect(classifyPhoneInput(input)).toEqual({ kind: "invalid" });
  });
});

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
