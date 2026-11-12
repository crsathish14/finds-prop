import { describe, expect, it } from "vitest";
import {
  ASSISTANT_BRAND_NAME,
  MAX_INPUT_CHARACTERS,
  MAX_MODEL_ROUNDS,
  MAX_OUTPUT_TOKENS,
  MAX_PARALLEL_READ_CALLS,
  MAX_TOOL_CALLS_PER_MESSAGE,
  TOOL_TIMEOUT_MS,
} from "../ai";

describe("UT-ai-config: the AI chat numbers (ADR-128 sections 4.5 and 7, decision D9)", () => {
  it("has the values the owner accepted on 12 Nov 2026", () => {
    expect(MAX_MODEL_ROUNDS).toBe(5);
    expect(MAX_TOOL_CALLS_PER_MESSAGE).toBe(6);
    expect(MAX_PARALLEL_READ_CALLS).toBe(3);
    expect(TOOL_TIMEOUT_MS).toBe(3000);
    expect(MAX_INPUT_CHARACTERS).toBe(1000);
    expect(MAX_OUTPUT_TOKENS).toBe(1200);
  });

  it("calls the product findsprop, in lowercase (ADR-128 D11)", () => {
    expect(ASSISTANT_BRAND_NAME).toBe("findsprop");
  });

  it("lets the tool-call cap be reached: only rounds 1 to 4 use tools, the last round only answers", () => {
    const roundsThatMayUseTools = MAX_MODEL_ROUNDS - 1;
    expect(roundsThatMayUseTools * MAX_PARALLEL_READ_CALLS).toBeGreaterThanOrEqual(
      MAX_TOOL_CALLS_PER_MESSAGE,
    );
  });
});
