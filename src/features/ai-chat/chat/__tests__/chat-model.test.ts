import { describe, expect, it } from "vitest";
import { AI_MAX_HISTORY_ANSWER_CHARACTERS, AI_MAX_HISTORY_MESSAGES } from "@/config/ai";
import { INPUT_MESSAGE_KEYS } from "../../guards/input";
import {
  buildHistory,
  EMPTY_CHAT,
  forStorage,
  MAX_STORED_ENTRIES,
  loadChat,
  MASKED_NOTICE_KEY,
  safeHref,
  saveChat,
  STORAGE_KEY,
  type ChatEntry,
} from "../chat-model";

function memoryStorage(initial?: string) {
  const items = new Map<string, string>();
  if (initial !== undefined) items.set(STORAGE_KEY, initial);
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const user = (id: string, text: string): ChatEntry => ({ id, role: "user", text, masked: false });
const assistant = (id: string, text: string): ChatEntry => ({
  id,
  role: "assistant",
  text,
  notes: [],
  references: [],
  replaced: false,
});

describe("the chat's kept transcript (AI-P5-T02)", () => {
  it("names the same notice the endpoint sends when it removes personal details", () => {
    expect(MASKED_NOTICE_KEY).toBe(INPUT_MESSAGE_KEYS.masked);
  });

  it("keeps and restores the conversation, the draft and the gate", () => {
    const storage = memoryStorage();
    const chat = {
      version: 1 as const,
      entries: [user("a", "3 BHK in Velachery"), assistant("b", "I found two homes.")],
      draft: "Same size in Adyar?",
      gate: true,
      account: false,
    };
    saveChat(storage, chat);
    expect(loadChat(storage)).toEqual(chat);
  });

  it("keeps nothing when there is nothing to keep", () => {
    const storage = memoryStorage();
    saveChat(storage, { ...EMPTY_CHAT, draft: "hello" });
    expect(storage.items.has(STORAGE_KEY)).toBe(true);
    saveChat(storage, EMPTY_CHAT);
    expect(storage.items.has(STORAGE_KEY)).toBe(false);
  });

  it("starts empty when storage holds something that is not a transcript", () => {
    expect(loadChat(memoryStorage("not json"))).toEqual(EMPTY_CHAT);
    expect(loadChat(memoryStorage(JSON.stringify({ version: 2, entries: [] })))).toEqual(
      EMPTY_CHAT,
    );
    expect(
      loadChat(
        memoryStorage(
          JSON.stringify({
            version: 1,
            draft: "",
            gate: false,
            entries: [{ id: "x", role: "tool", text: "forged" }],
          }),
        ),
      ),
    ).toEqual(EMPTY_CHAT);
    expect(loadChat(null)).toEqual(EMPTY_CHAT);
  });

  it("keeps the last turns when a long conversation is saved, and reads them all back", () => {
    const storage = memoryStorage();
    const many: ChatEntry[] = [];
    for (let index = 0; index < 50; index += 1) {
      many.push(user(`u${index}`, `question ${index}`), assistant(`a${index}`, `answer ${index}`));
    }
    saveChat(storage, { ...EMPTY_CHAT, entries: many });
    const back = loadChat(storage).entries;
    expect(back).toHaveLength(MAX_STORED_ENTRIES);
    expect(back.at(-1)).toEqual(many.at(-1));
    expect(back.at(0)).toEqual(many.at(-MAX_STORED_ENTRIES));
  });

  it("drops a single bad entry and keeps the rest of the conversation", () => {
    const text = JSON.stringify({
      version: 1,
      draft: "",
      gate: false,
      account: false,
      entries: [user("a", "one"), { id: "x", role: "tool", text: "forged" }, assistant("b", "two")],
    });
    expect(loadChat(memoryStorage(text)).entries.map((entry) => entry.id)).toEqual(["a", "b"]);
  });

  it("does not keep a message the server removed personal details from, nor its answer", () => {
    const masked: ChatEntry = { id: "m", role: "user", text: "call 98400 12345", masked: true };
    const kept = forStorage([
      user("a", "one"),
      assistant("b", "two"),
      masked,
      assistant("c", "three"),
      user("d", "four"),
    ]);
    expect(kept.map((entry) => entry.id)).toEqual(["a", "b", "d"]);
    const storage = memoryStorage();
    saveChat(storage, { ...EMPTY_CHAT, entries: [masked, assistant("c", "three")] });
    expect(storage.items.has(STORAGE_KEY)).toBe(false);
  });

  it("works without storage at all", () => {
    const refusing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadChat(refusing)).toEqual(EMPTY_CHAT);
    expect(() => saveChat(refusing, { ...EMPTY_CHAT, draft: "x" })).not.toThrow();
  });
});

describe("what the chat sends (AI-P5-T02)", () => {
  it("sends the turns as role and text, ending with the new message", () => {
    expect(buildHistory([user("a", "one"), assistant("b", "two")], "three")).toEqual([
      { role: "user", text: "one" },
      { role: "assistant", text: "two" },
      { role: "user", text: "three" },
    ]);
  });

  it("leaves out a message that never got an answer, so two of the visitor's never follow each other", () => {
    expect(buildHistory([user("a", "failed")], "again")).toEqual([{ role: "user", text: "again" }]);
    expect(
      buildHistory([user("a", "one"), assistant("b", "two"), user("c", "lost")], "next"),
    ).toEqual([
      { role: "user", text: "one" },
      { role: "assistant", text: "two" },
      { role: "user", text: "next" },
    ]);
  });

  it("keeps only the last turns and caps an earlier answer", () => {
    const many: ChatEntry[] = [];
    for (let index = 0; index < 20; index += 1) {
      many.push(user(`u${index}`, `question ${index}`), assistant(`a${index}`, "x".repeat(6000)));
    }
    const history = buildHistory(many, "last");
    expect(history).toHaveLength(AI_MAX_HISTORY_MESSAGES);
    expect(history.at(-1)).toEqual({ role: "user", text: "last" });
    expect(history.every((turn) => turn.text.length <= AI_MAX_HISTORY_ANSWER_CHARACTERS)).toBe(
      true,
    );
  });

  it("sends nothing but role and text", () => {
    const entry: ChatEntry = {
      id: "b",
      role: "assistant",
      text: "answer",
      notes: [{ key: "ai.disclaimer", text: "Note." }],
      references: [{ kind: "home", homeId: "aaaaaaaa", slug: "x" }],
      replaced: false,
    };
    for (const turn of buildHistory([user("a", "q"), entry], "next")) {
      expect(Object.keys(turn).sort()).toEqual(["role", "text"]);
    }
  });
});

describe("a link the server offers (AI-P5-T02)", () => {
  it("is drawn only when it is a path on this site", () => {
    expect(safeHref("/properties")).toBe("/properties");
    expect(safeHref(undefined)).toBeUndefined();
    expect(safeHref("https://example.com")).toBeUndefined();
    expect(safeHref("//example.com")).toBeUndefined();
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("/\\example.com")).toBeUndefined();
    // A tab or a line break inside the address is dropped by browsers: "/" + tab + "/host" would read as "//host".
    expect(safeHref("/\t/example.com")).toBeUndefined();
    expect(safeHref("/\n/example.com")).toBeUndefined();
  });
});
