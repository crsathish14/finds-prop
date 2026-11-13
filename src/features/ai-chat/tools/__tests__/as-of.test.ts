import { describe, expect, it } from "vitest";
import { asOfText } from "../as-of";
import { TOOL_CONTEXT } from "./fixtures";

// UT-ai-as-of (ADR-128 section 13): the time a tool result says its data was read, in India time, as the
// pages write a date and a time.

describe("UT-ai-as-of: the time a result was read", () => {
  it("writes a read time in India time", () => {
    expect(asOfText("2026-11-13T10:12:00.000Z", TOOL_CONTEXT)).toBe("13 Nov 2026, 3:42 pm");
  });

  it("moves to the next day when India is already there", () => {
    expect(asOfText("2026-11-13T19:05:00.000Z", TOOL_CONTEXT)).toBe("14 Nov 2026, 12:35 am");
  });
});
