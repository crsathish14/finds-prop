import { describe, expect, it } from "vitest";
import { chatContextHref, readContextParams } from "../page-context";

// UT-ai-page-context: the link carries ids and nothing else.

describe("chatContextHref", () => {
  it("builds the three links from ids only", () => {
    expect(chatContextHref({ kind: "home", shortId: "k3m9p2xw" })).toBe("/ai-search?home=k3m9p2xw");
    expect(chatContextHref({ kind: "project", slug: "green-park" })).toBe(
      "/ai-search?project=green-park",
    );
    expect(chatContextHref({ kind: "compare", shortIds: ["k3m9p2xw", "b4c5d6e7"] })).toBe(
      "/ai-search?compare=k3m9p2xw,b4c5d6e7",
    );
  });

  it("encodes what it is given, so it cannot add a parameter", () => {
    const href = chatContextHref({ kind: "home", shortId: "a&project=x" });
    expect(new URL(href, "http://localhost").searchParams.get("project")).toBeNull();
  });
});

describe("readContextParams", () => {
  it("reads the three parameters as plain strings, first value only", () => {
    expect(readContextParams({ home: ["a", "b"], project: "p", compare: "x,y" })).toEqual({
      home: "a",
      project: "p",
      compare: ["x", "y"],
    });
    expect(readContextParams({})).toEqual({
      home: undefined,
      project: undefined,
      compare: undefined,
    });
  });
});
