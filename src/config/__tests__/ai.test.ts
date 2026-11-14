import { describe, expect, it } from "vitest";
import {
  ASSISTANT_BRAND_NAME,
  EMI_DEFAULT_DOWN_PAYMENT_PERCENT,
  EMI_DEFAULT_YEARS,
  EMI_EXAMPLE_ANNUAL_RATE_PERCENT,
  MAX_INPUT_CHARACTERS,
  MAX_MODEL_ROUNDS,
  MAX_OUTPUT_TOKENS,
  MAX_PARALLEL_READ_CALLS,
  MAX_TOOL_CALLS_PER_MESSAGE,
  MAX_TOOL_RESULT_ITEMS,
  MAX_UNTRUSTED_TEXT_CHARACTERS,
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

  it("keeps a tool result small: ten items, third-party text cut at 1,500 characters (section 5)", () => {
    expect(MAX_TOOL_RESULT_ITEMS).toBe(10);
    expect(MAX_UNTRUSTED_TEXT_CHARACTERS).toBe(1500);
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

  it("has the EMI defaults of ADR-128 section 5.2: 20% down, 20 years, the owner's example rate of 7.2% (14 Nov 2026)", () => {
    expect(EMI_DEFAULT_DOWN_PAYMENT_PERCENT).toBe(20);
    expect(EMI_DEFAULT_YEARS).toBe(20);
    expect(EMI_EXAMPLE_ANNUAL_RATE_PERCENT).toBe(7.2);
  });
});
