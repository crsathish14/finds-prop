import { beforeEach, describe, expect, it, vi } from "vitest";

const insert = vi.fn();
const from = vi.fn();
const createAdminSupabase = vi.fn();
vi.mock("@/server/supabase/admin.server", () => ({
  createAdminSupabase: (requestId?: string) => createAdminSupabase(requestId) as unknown,
}));

import { writeAiUsage, type AiUsageEvent } from "@/server/audit/ai-usage";

const event: AiUsageEvent = {
  requestId: "req-aaaaaaaa",
  at: "2026-11-14T10:00:00.000Z",
  caller: "anonymous",
  userId: null,
  visitorHash: "0123456789abcdef0123456789abcdef01234567",
  provider: "openai",
  model: "gpt-test-1.0",
  promptVersion: "v1",
  outcome: "answered",
  limitedBy: null,
  inputTags: ["personal_data"],
  outputTags: ["advice_phrase"],
  outputCounts: { advice_phrase: 2 },
  numberUngrounded: 1,
  rounds: 2,
  retried: false,
  toolCallsPerRound: [1],
  toolsRan: ["search_properties"],
  inputTokens: 900,
  outputTokens: 120,
  cachedInputTokens: 400,
  agentLimit: null,
  fallbackReason: null,
  durationMs: 4200,
};

describe("UT-ai-usage: writeAiUsage", () => {
  beforeEach(() => {
    insert.mockReset().mockResolvedValue({ error: null });
    from.mockReset().mockReturnValue({ insert });
    createAdminSupabase.mockReset().mockReturnValue({ from });
  });

  it("writes one row to ai_usage_events through the service role, with the request id", async () => {
    await writeAiUsage(event);
    expect(createAdminSupabase).toHaveBeenCalledWith("req-aaaaaaaa");
    expect(from).toHaveBeenCalledWith("ai_usage_events");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0]?.[0]).toEqual({
      request_id: "req-aaaaaaaa",
      occurred_at: "2026-11-14T10:00:00.000Z",
      caller: "anonymous",
      user_id: null,
      visitor_hash: "0123456789abcdef0123456789abcdef01234567",
      provider: "openai",
      model: "gpt-test-1.0",
      prompt_version: "v1",
      outcome: "answered",
      limited_by: null,
      input_tags: ["personal_data"],
      output_tags: ["advice_phrase"],
      output_counts: { advice_phrase: 2 },
      number_ungrounded: 1,
      rounds: 2,
      retried: false,
      tool_calls_per_round: [1],
      tools_ran: ["search_properties"],
      input_tokens: 900,
      output_tokens: 120,
      cached_input_tokens: 400,
      agent_limit: null,
      fallback_reason: null,
      duration_ms: 4200,
    });
  });

  it("never mixes the two identities: a signed-in row has a user and no hash, an anonymous one the reverse", async () => {
    await writeAiUsage({ ...event, caller: "signed_in", userId: "user-1" });
    expect(insert.mock.calls[0]?.[0]).toMatchObject({
      caller: "signed_in",
      user_id: "user-1",
      visitor_hash: null,
    });
    await writeAiUsage({ ...event, userId: "user-1" });
    expect(insert.mock.calls[1]?.[0]).toMatchObject({
      user_id: null,
      visitor_hash: event.visitorHash,
    });
  });

  it("has no field for text: only the known columns reach the database", async () => {
    await writeAiUsage({
      ...event,
      messageText: "find me a flat",
      phone: "9841000000",
    } as AiUsageEvent);
    const row = insert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(row)).not.toContain("messageText");
    expect(Object.keys(row)).not.toContain("phone");
    expect(JSON.stringify(row)).not.toContain("flat");
    expect(JSON.stringify(row)).not.toContain("9841000000");
  });

  it("stores a bad number as 0 instead of being refused by the database", async () => {
    await writeAiUsage({
      ...event,
      inputTokens: -5,
      outputTokens: Number.NaN,
      rounds: 2.9,
      toolCallsPerRound: [1.5, -1],
      outputCounts: { advice_phrase: -3 },
    });
    expect(insert.mock.calls[0]?.[0]).toMatchObject({
      input_tokens: 0,
      output_tokens: 0,
      rounds: 2,
      tool_calls_per_round: [1, 0],
      output_counts: { advice_phrase: 0 },
    });
  });

  it("fails with INTERNAL, naming nothing from the database, when the insert is refused", async () => {
    insert.mockResolvedValue({ error: { message: 'relation "x" does not exist' } });
    await expect(writeAiUsage(event)).rejects.toMatchObject({
      code: "INTERNAL",
      message: "Could not write the usage row",
    });
  });
});
