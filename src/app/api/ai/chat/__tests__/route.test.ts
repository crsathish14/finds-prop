import { describe, expect, it, vi } from "vitest";
import {
  AI_MESSAGE_HARD_STOP_MS,
  AI_MESSAGE_TIME_LIMIT_MS,
  AI_ROUTE_MAX_DURATION_SECONDS,
} from "@/config/ai";

// UT-ai-route (ADR-128 section 4.5): the route composes only, and the time for one message stays under its maxDuration.

const postAiChat = vi.hoisted(() => vi.fn());
vi.mock("@/features/ai-chat", () => ({ postAiChat }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => undefined) }));

const route = await import("../route");

describe("UT-ai-route: POST /api/ai/chat", () => {
  it("hands the request to the feature and returns what it returns", async () => {
    const answer = new Response("ok");
    postAiChat.mockResolvedValue(answer);
    const request = new Request("http://localhost:3000/api/ai/chat", { method: "POST" });
    expect(await route.POST(request)).toBe(answer);
    expect(postAiChat).toHaveBeenCalledWith(request);
  });

  it("has only a POST handler", () => {
    expect(Object.keys(route).sort()).toEqual(["POST", "maxDuration"]);
  });

  it("writes the same maxDuration as the config, and the time limit and the hard stop stay below it", () => {
    expect(route.maxDuration).toBe(AI_ROUTE_MAX_DURATION_SECONDS);
    expect(AI_MESSAGE_TIME_LIMIT_MS).toBeLessThan(AI_MESSAGE_HARD_STOP_MS);
    expect(AI_MESSAGE_HARD_STOP_MS).toBeLessThan(route.maxDuration * 1000);
  });
});
