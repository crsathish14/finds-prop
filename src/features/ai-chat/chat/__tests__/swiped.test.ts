// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readSwiped, resetSwipedForTests, SWIPED_KEY, writeSwiped } from "../swiped";

beforeEach(() => {
  window.localStorage.clear();
  resetSwipedForTests();
});

afterEach(() => vi.restoreAllMocks());

describe("the remembered first swipe to the cards (owner decision A7)", () => {
  it("is false until the visitor has swiped, then true and kept in this browser", () => {
    expect(readSwiped()).toBe(false);
    writeSwiped();
    expect(readSwiped()).toBe(true);
    expect(window.localStorage.getItem(SWIPED_KEY)).toBe("1");
    expect(SWIPED_KEY).toBe("findsprop.ai-cards-swiped");
  });

  it("is read back from an earlier visit", () => {
    window.localStorage.setItem(SWIPED_KEY, "1");
    expect(readSwiped()).toBe(true);
  });

  it("shows the hint every time when storage cannot be read, with no error", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSwiped()).toBe(false);
  });

  it("keeps the first swipe for this visit when storage cannot be written", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => writeSwiped()).not.toThrow();
    expect(readSwiped()).toBe(true);
  });
});
