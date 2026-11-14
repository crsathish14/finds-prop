import { describe, expect, it, vi } from "vitest";
import { fakeFetch, fakeStore } from "./delivery-fixtures";

vi.mock("server-only", () => ({}));
vi.mock("../service", () => ({ createDeliveryStore: vi.fn() }));
const reportError = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/server/observability", () => ({ reportError }));

const { handleCrmRetry } = await import("../retry-handler");

const TOKEN = "test-token-not-real-0123456789abcdef";
const post = (token: string) =>
  new Request("https://findprop.example/api/internal/crm-retry", {
    method: "POST",
    headers: { "x-cron-token": token, "x-request-id": "req-abcdefgh" },
  });

describe("UT-crm-retry-route: error tracker (ADR-130)", () => {
  it("reports the failure when the job cannot run, under the job's route", async () => {
    reportError.mockClear();
    const { store } = fakeStore({ token: TOKEN, claimFails: true });
    const response = await handleCrmRetry(post(TOKEN), { store, fetch: fakeFetch().fetcher });
    expect(response.status).toBe(500);
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      source: "handler",
      requestId: "req-abcdefgh",
      route: "crm-retry",
    });
  });

  it("reports nothing for a wrong token or a good run", async () => {
    reportError.mockClear();
    const { store } = fakeStore({ token: TOKEN, due: [] });
    await handleCrmRetry(post("wrong-token-0123456789abcdef-xyz"), {
      store,
      fetch: fakeFetch().fetcher,
    });
    await handleCrmRetry(post(TOKEN), { store, fetch: fakeFetch().fetcher });
    expect(reportError).not.toHaveBeenCalled();
  });
});
