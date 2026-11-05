import { describe, expect, it } from "vitest";
import {
  addEntry,
  compareBarMode,
  compareHref,
  COMPARE_KEY,
  hasEntry,
  isFull,
  parseIdsParam,
  parseSelection,
  removeEntry,
  serializeSelection,
  type CompareEntry,
} from "../store";

const FIRST = "k3x9a2bd";
const SECOND = "m4y8b3ce";
const THIRD = "n5z7c4dh";
const FOURTH = "p6a2d5ej";

const entry = (id: string, title = `Home ${id}`): CompareEntry => ({
  id,
  title,
  cover: `https://x.supabase.co/storage/v1/object/public/listing-photos/${id}.webp`,
});

describe("UT-compare-store: the selection", () => {
  it("is kept under one key", () => {
    expect(COMPARE_KEY).toBe("findsprop:compare:v1");
  });

  it("reads what it wrote", () => {
    const list = [entry(FIRST), entry(SECOND)];
    expect(parseSelection(serializeSelection(list))).toEqual(list);
  });

  it("reads nothing from nothing, from text that is not JSON, and from JSON that is not a list", () => {
    expect(parseSelection(null)).toEqual([]);
    expect(parseSelection("not json")).toEqual([]);
    expect(parseSelection('{"id":"k3x9a2bd"}')).toEqual([]);
    expect(parseSelection("7")).toEqual([]);
  });

  it("reads a bare id, and drops entries with no valid id, repeats and everything past the third", () => {
    const text = JSON.stringify([
      FIRST,
      { id: "nope" },
      5,
      null,
      { id: FIRST },
      SECOND,
      THIRD,
      FOURTH,
    ]);
    expect(parseSelection(text).map((item) => item.id)).toEqual([FIRST, SECOND, THIRD]);
  });

  it("keeps only a cover it is willing to draw: https, http or a rooted path", () => {
    const parse = (cover: unknown) =>
      parseSelection(JSON.stringify([{ id: FIRST, title: "x", cover }]))[0]?.cover;
    expect(parse("https://x.supabase.co/a.webp")).toBe("https://x.supabase.co/a.webp");
    expect(parse("/design-lab/listings/home-a.svg")).toBe("/design-lab/listings/home-a.svg");
    expect(parse("javascript:alert(1)")).toBeNull();
    expect(parse("//evil.example/a.webp")).toBeNull();
    expect(parse("data:image/svg+xml,<svg/>")).toBeNull();
    expect(parse(42)).toBeNull();
    expect(parse("x".repeat(600))).toBeNull();
  });

  it("cuts a long title", () => {
    const [first] = parseSelection(JSON.stringify([{ id: FIRST, title: "t".repeat(400) }]));
    expect(first?.title).toHaveLength(140);
  });
});

describe("UT-compare-store: adding and removing", () => {
  it("adds a home at the end", () => {
    expect(addEntry([entry(FIRST)], entry(SECOND)).map((item) => item.id)).toEqual([FIRST, SECOND]);
  });

  it("does nothing for a home that is already there", () => {
    expect(addEntry([entry(FIRST)], entry(FIRST))).toHaveLength(1);
  });

  it("stops at three and says it is full", () => {
    const three = [entry(FIRST), entry(SECOND), entry(THIRD)];
    expect(isFull(three)).toBe(true);
    expect(isFull(three.slice(0, 2))).toBe(false);
    expect(addEntry(three, entry(FOURTH))).toEqual(three);
  });

  it("does not add something that is not a public id", () => {
    expect(addEntry([], { id: "../etc", title: "x", cover: null })).toEqual([]);
  });

  it("does not change the list it is given", () => {
    const list = [entry(FIRST)];
    addEntry(list, entry(SECOND));
    removeEntry(list, FIRST);
    expect(list).toHaveLength(1);
  });

  it("removes one home and knows what is there", () => {
    const list = [entry(FIRST), entry(SECOND)];
    expect(removeEntry(list, FIRST).map((item) => item.id)).toEqual([SECOND]);
    expect(removeEntry(list, THIRD)).toEqual(list);
    expect(hasEntry(list, SECOND)).toBe(true);
    expect(hasEntry(list, THIRD)).toBe(false);
  });
});

describe("UT-compare-store: the address of the comparison", () => {
  it("lists the ids in order", () => {
    expect(compareHref([FIRST, SECOND, THIRD])).toBe(`/compare?ids=${FIRST},${SECOND},${THIRD}`);
  });

  it("is the plain page for no valid id, and keeps at most three", () => {
    expect(compareHref([])).toBe("/compare");
    expect(compareHref(["bad"])).toBe("/compare");
    expect(compareHref([FIRST, SECOND, THIRD, FOURTH])).toBe(
      `/compare?ids=${FIRST},${SECOND},${THIRD}`,
    );
  });

  it("reads the ids of an address: valid ones, once each, the first three", () => {
    expect(parseIdsParam(`${FIRST},${SECOND},${FIRST},bad, ${THIRD} ,${FOURTH}`)).toEqual([
      FIRST,
      SECOND,
      THIRD,
    ]);
    expect(parseIdsParam([`${FIRST},${SECOND}`, `${THIRD}`])).toEqual([FIRST, SECOND]);
    expect(parseIdsParam(undefined)).toEqual([]);
    expect(parseIdsParam("")).toEqual([]);
  });
});

describe("UT-compare-store: where the bar is drawn", () => {
  it("is above the bottom bar on the homepage and the results", () => {
    expect(compareBarMode("/")).toBe("above-bottom-bar");
    expect(compareBarMode("/properties")).toBe("above-bottom-bar");
    expect(compareBarMode("/properties?bhk=3")).toBe("above-bottom-bar");
    expect(compareBarMode("/properties/")).toBe("above-bottom-bar");
  });

  it("is for wide screens only beside a home's page", () => {
    expect(compareBarMode("/properties/3-bhk-velachery-k3x9a2bd")).toBe("wide-only");
  });

  it("is not drawn on the comparison or anywhere else", () => {
    for (const path of [
      "/compare",
      "/compare?ids=a",
      "/projects",
      "/contact",
      "/auth",
      "/dashboard",
    ]) {
      expect(compareBarMode(path), path).toBe("hidden");
    }
  });
});
