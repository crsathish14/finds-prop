import { describe, expect, it } from "vitest";
import { savedHomeInputSchema } from "../schemas";

describe("savedHomeInputSchema: the home a save names", () => {
  it("takes a short id in the address's alphabet", () => {
    expect(savedHomeInputSchema.safeParse({ shortId: "k3x9a2bd" }).success).toBe(true);
  });

  it.each([
    ["too short", "k3x9a2b"],
    ["too long", "k3x9a2bdd"],
    ["a look-alike character", "k3x9a2b0"],
    ["a capital letter", "K3x9a2bd"],
    ["a path", "../admin"],
    ["empty", ""],
  ])("refuses %s", (_label, shortId) => {
    expect(savedHomeInputSchema.safeParse({ shortId }).success).toBe(false);
  });

  it("refuses a request with no id at all", () => {
    expect(savedHomeInputSchema.safeParse({}).success).toBe(false);
  });
});
