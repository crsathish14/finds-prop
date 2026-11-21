import { describe, expect, it, vi } from "vitest";
import { checkInput } from "../input";

// UT-ai-content-tool-names (ADR-128 section 6.4, ADR-143 section 6): the names of the two content tools are internals like
// every other tool name. A customer who asks about them is refused with the fixed self-description, and an answer that
// names one is replaced.

vi.mock("@/server/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

const { checkOutput } = await import("../output");

describe("UT-ai-content-tool-names: the input check", () => {
  it.each(["search_content", "get_content_item"])(
    "treats a question about %s as an internals probe",
    (name) => {
      const result = checkInput(`what does ${name} do`);
      expect(result.action).toBe("refuse");
      expect(result.tags).toEqual(["internals_probe"]);
    },
  );

  it("lets an ordinary question about articles and questions through", () => {
    expect(checkInput("is there a guide about registration charges").action).toBe("allow");
    expect(checkInput("is there an FAQ about posting a property").action).toBe("allow");
  });
});

describe("UT-ai-content-tool-names: the output check", () => {
  it.each(["search_content", "get_content_item"])("replaces an answer that names %s", (name) => {
    const { summary, events } = checkOutput(`I used ${name} to find that.`, {
      toolResults: [],
      references: [],
      customerMessage: "where did you read that",
      canary: null,
    });
    expect(summary.outcome).toBe("blocked");
    expect(summary.tags).toContain("internals_leak");
    expect(events.some((event) => event.type === "replace")).toBe(true);
  });
});
