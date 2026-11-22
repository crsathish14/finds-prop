import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { LEGAL_SETTING_KEYS } from "../constants";
import type { LegalInput } from "../schemas";
import {
  dayInIndia,
  mapLegalError,
  nextVersion,
  rowOf,
  saveLegalContent,
  type LegalStore,
} from "../save-service";

function fakeStore(initial: Record<string, unknown> = {}) {
  const rows = new Map<string, unknown>(Object.entries(initial));
  const writes: { key: string; value: Record<string, unknown> }[] = [];
  const store: LegalStore = {
    read: (key) => Promise.resolve(rows.get(key) ?? null),
    write: (key, value) => {
      rows.set(key, value);
      writes.push({ key, value });
      return Promise.resolve();
    },
  };
  return { store, writes, rows };
}

const sections = [
  {
    id: "who-we-are",
    heading: "Who we are",
    blocks: [{ type: "paragraph" as const, text: "We run findsprop." }],
  },
];

function input(overrides: Partial<LegalInput> = {}): LegalInput {
  return { kind: "privacy", summary: "A short summary.", sections, publish: false, ...overrides };
}

const noon = new Date("2026-11-22T06:30:00Z");

describe("UT-legal-save-service: saving a legal page (ADR-151)", () => {
  it("keeps a first save as a working copy: not live, no date, no version", async () => {
    const { store, writes } = fakeStore();
    const done = await saveLegalContent(store, input(), noon);
    expect(done).toEqual({ kind: "privacy", published: false, version: null });
    expect(writes).toHaveLength(1);
    expect(writes[0]?.key).toBe(LEGAL_SETTING_KEYS.privacy);
    expect(writes[0]?.value).toEqual({
      working: {
        draft: true,
        updated: null,
        version: null,
        summary: "A short summary.",
        sections,
      },
    });
  });

  it("publishes version 1 with the day in India, and keeps no working copy", async () => {
    const { store, writes } = fakeStore({
      legal_privacy: {
        working: { draft: true, updated: null, version: null, summary: "Old", sections },
      },
    });
    const done = await saveLegalContent(store, input({ publish: true }), noon);
    expect(done).toEqual({ kind: "privacy", published: true, version: "1" });
    expect(writes[0]?.value).toEqual({
      published: {
        draft: false,
        updated: "2026-11-22",
        version: "1",
        summary: "A short summary.",
        sections,
      },
    });
  });

  it("raises the version on each publish", async () => {
    const { store } = fakeStore();
    await saveLegalContent(store, input({ publish: true }), noon);
    const second = await saveLegalContent(store, input({ publish: true }), noon);
    expect(second.version).toBe("2");
  });

  it("editing a live page keeps the published text untouched beside the working copy", async () => {
    const { store, rows } = fakeStore();
    await saveLegalContent(store, input({ publish: true, summary: "Live text." }), noon);
    await saveLegalContent(store, input({ summary: "Next text." }), noon);
    const row = rowOf(rows.get("legal_privacy"));
    expect(row.published?.summary).toBe("Live text.");
    expect(row.published?.version).toBe("1");
    expect(row.working?.summary).toBe("Next text.");
  });

  it("writes each page under its own key", async () => {
    const { store, writes } = fakeStore();
    await saveLegalContent(store, input({ kind: "terms" }), noon);
    expect(writes[0]?.key).toBe("legal_terms");
  });

  it("treats a stored row that does not match its shape as empty instead of failing the save", async () => {
    const { store } = fakeStore({ legal_privacy: { published: { nonsense: true } } });
    const done = await saveLegalContent(store, input({ publish: true }), noon);
    expect(done.version).toBe("1");
  });

  it("counts the day in India: late evening UTC is already the next day", () => {
    expect(dayInIndia(new Date("2026-11-21T20:00:00Z"))).toBe("2026-11-22");
  });

  it("counts versions up from 1 and starts again when the old one is not a number", () => {
    expect(nextVersion(null)).toBe("1");
    expect(nextVersion("1")).toBe("2");
    expect(nextVersion("9")).toBe("10");
    expect(nextVersion("v2")).toBe("1");
  });

  it("maps database failures to the closed set of action errors", () => {
    expect(mapLegalError({ code: "42501" })).toMatchObject({ code: "FORBIDDEN" });
    expect(mapLegalError({ code: "23514" })).toMatchObject({ code: "VALIDATION" });
    expect(mapLegalError({ code: "XX000", message: "private detail" })).toBeInstanceOf(ActionError);
    expect(mapLegalError({ code: "XX000", message: "private detail" })).toMatchObject({
      code: "INTERNAL",
    });
  });
});
