import { describe, expect, it, vi } from "vitest";
import { DUE, fakeFetch, fakeStore } from "./delivery-fixtures";

vi.mock("server-only", () => ({}));
vi.mock("../service", () => ({ createDeliveryStore: vi.fn() }));

const { handleCrmRetry, sameSecret } = await import("../retry-handler");

const TOKEN = "test-token-not-real-0123456789abcdef";
const post = (token?: string | null) =>
  new Request("https://findprop.example/api/internal/crm-retry", {
    method: "POST",
    headers: token === undefined || token === null ? {} : { "x-cron-token": token },
  });

describe("UT-crm-retry-route: the retry job's door (S7-T09 B2, BR-66, BR-67)", () => {
  it("compares secrets exactly", () => {
    expect(sameSecret(TOKEN, TOKEN)).toBe(true);
    expect(sameSecret(TOKEN, `${TOKEN}x`)).toBe(false);
    expect(sameSecret("", TOKEN)).toBe(false);
  });

  it.each([
    ["no token sent", null],
    ["an empty token", ""],
    ["a wrong token", "test-token-not-real-0123456789abcdee"],
    ["a token of another length", "short"],
  ])("lets nobody in with %s, and claims nothing", async (_label, sent) => {
    const { store, calls } = fakeStore({ token: TOKEN, due: [DUE] });
    const response = await handleCrmRetry(post(sent), { store, fetch: fakeFetch().fetcher });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(calls).toEqual([]);
  });

  it("lets nobody in when no token has been set", async () => {
    const { store, calls } = fakeStore({ token: null, due: [DUE] });
    const response = await handleCrmRetry(post(TOKEN), { store, fetch: fakeFetch().fetcher });
    expect(response.status).toBe(401);
    expect(calls).toEqual([]);
  });

  it("sends what is due, answers only the counts, and disarms the job once nothing waits", async () => {
    const { store, calls, recorded } = fakeStore({ token: TOKEN, due: [DUE], waiting: false });
    const { fetcher, sent } = fakeFetch(200);
    const response = await handleCrmRetry(post(TOKEN), { store, fetch: fetcher });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 1, sent: 1, failed: 0 });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(sent).toHaveLength(1);
    expect(recorded).toHaveLength(1);
    expect(calls).toEqual([
      "claim:10:any",
      `read:${DUE.integrationId}`,
      `record:${DUE.submissionId}`,
      "hasWaiting",
      "disarm",
    ]);
  });

  it("keeps the job while a retry is waiting, and does not arm it again", async () => {
    const { store, calls } = fakeStore({ token: TOKEN, due: [DUE], waiting: true });
    const response = await handleCrmRetry(post(TOKEN), {
      store,
      fetch: fakeFetch(500, "down").fetcher,
    });
    expect(await response.json()).toEqual({ claimed: 1, sent: 0, failed: 1 });
    expect(calls).toContain("hasWaiting");
    expect(calls).not.toContain("disarm");
    expect(calls).not.toContain("arm");
  });

  it("answers an empty run, and still disarms an idle job", async () => {
    const { store, calls } = fakeStore({ token: TOKEN, due: [], waiting: false });
    const response = await handleCrmRetry(post(TOKEN), { store, fetch: fakeFetch().fetcher });
    expect(await response.json()).toEqual({ claimed: 0, sent: 0, failed: 0 });
    expect(calls).toEqual(["claim:10:any", "hasWaiting", "disarm"]);
  });

  it("is not stopped by a job that cannot be disarmed", async () => {
    const { store } = fakeStore({ token: TOKEN, due: [], waiting: false, disarmFails: true });
    const response = await handleCrmRetry(post(TOKEN), { store, fetch: fakeFetch().fetcher });
    expect(response.status).toBe(200);
  });

  it("answers a plain 500, with nothing about the cause, when the claim fails", async () => {
    const { store } = fakeStore({ token: TOKEN, claimFails: true });
    const response = await handleCrmRetry(post(TOKEN), { store, fetch: fakeFetch().fetcher });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "failed" });
  });
});
