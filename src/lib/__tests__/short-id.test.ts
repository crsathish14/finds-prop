import { describe, expect, it } from "vitest";
import { isShortId } from "../short-id";

describe("UT-short-id: the public id of a listing", () => {
  it("accepts eight characters from the alphabet", () => {
    expect(isShortId("k3x9a2bd")).toBe(true);
    expect(isShortId("zzzzzzzz")).toBe(true);
    expect(isShortId("22222222")).toBe(true);
  });

  it("refuses the wrong length, capitals, look-alike characters and anything else", () => {
    for (const bad of [
      "",
      "k3x9a2b",
      "k3x9a2bdd",
      "K3X9A2BD",
      "k3x9a2b0",
      "k3x9a2b1",
      "k3x9a2bi",
      "k3x9a2bl",
      "k3x9a2bo",
      "k3x9a2b-",
      " k3x9a2bd",
      "k3x9a2bd\n",
    ]) {
      expect(isShortId(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});
