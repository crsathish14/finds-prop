import { describe, expect, it } from "vitest";
import { MAX_INPUT_CHARACTERS } from "@/config/ai";
import { HOME_QUESTION_KEY, keepHomeQuestion, takeHomeQuestion } from "../home-question";

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

describe("the home page's question on its way to the chat (ADR-150)", () => {
  it("is kept trimmed and taken once", () => {
    const storage = memoryStorage();
    keepHomeQuestion(storage, "  Villas in Adyar  ");
    expect(takeHomeQuestion(storage)).toBe("Villas in Adyar");
    expect(storage.items.has(HOME_QUESTION_KEY)).toBe(false);
    expect(takeHomeQuestion(storage)).toBeNull();
  });

  it("keeps an empty question, which only opens the chat", () => {
    const storage = memoryStorage();
    keepHomeQuestion(storage, "   ");
    expect(takeHomeQuestion(storage)).toBe("");
  });

  it("is cut to what the chat accepts", () => {
    const storage = memoryStorage();
    keepHomeQuestion(storage, "a".repeat(MAX_INPUT_CHARACTERS + 50));
    expect(takeHomeQuestion(storage)).toHaveLength(MAX_INPUT_CHARACTERS);
  });

  it("ignores something else under its name, and a browser without storage", () => {
    const storage = memoryStorage();
    storage.setItem(HOME_QUESTION_KEY, "not json");
    expect(takeHomeQuestion(storage)).toBeNull();
    expect(storage.items.has(HOME_QUESTION_KEY)).toBe(false);
    storage.setItem(HOME_QUESTION_KEY, JSON.stringify({ text: 42 }));
    expect(takeHomeQuestion(storage)).toBeNull();
    expect(takeHomeQuestion(null)).toBeNull();
    expect(() => keepHomeQuestion(null, "hello")).not.toThrow();
  });

  it("does not fail when the storage refuses to write", () => {
    const storage = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(() => keepHomeQuestion(storage, "hello")).not.toThrow();
  });
});
