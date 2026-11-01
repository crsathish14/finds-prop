import { describe, expect, it } from "vitest";
import { readReturnPath, RETURN_PATH_HEADER } from "@/server/auth/return-path";

const withHeader = (value: string | null) =>
  new Headers(value === null ? {} : { [RETURN_PATH_HEADER]: value });

describe("UT-return-path: the address a guard sends a visitor back to (BR-06)", () => {
  it("returns a path on this site, query included", () => {
    expect(readReturnPath(withHeader("/dashboard?tab=saved"))).toBe("/dashboard?tab=saved");
  });

  it("returns nothing when the header is missing", () => {
    expect(readReturnPath(withHeader(null))).toBeUndefined();
  });

  it("refuses anything that could leave the site", () => {
    for (const evil of [
      "//evil.example",
      "https://evil.example",
      "/\\evil.example",
      "javascript:1",
    ]) {
      expect(readReturnPath(withHeader(evil))).toBeUndefined();
    }
  });
});
