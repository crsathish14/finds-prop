import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../service", () => ({ createSweepStore: vi.fn(() => ({})) }));
const sweepOrphanPhotos = vi.hoisted(() => vi.fn());
vi.mock("../sweep", () => ({ sweepOrphanPhotos }));
const reportError = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/server/observability", () => ({ reportError }));

const { handleSweepMedia } = await import("../sweep-handler");

const post = () =>
  new Request("https://findprop.example/api/internal/sweep-media", {
    method: "POST",
    headers: { "x-cron-token": "t", "x-request-id": "req-abcdefgh" },
  });

describe("UT-sweep-media-route: error tracker (ADR-130)", () => {
  it("reports a sweep that fails, and answers a plain 500", async () => {
    reportError.mockClear();
    sweepOrphanPhotos.mockRejectedValueOnce(new Error("storage down"));
    const response = await handleSweepMedia(post());
    expect(response.status).toBe(500);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      source: "handler",
      requestId: "req-abcdefgh",
      route: "sweep-media",
    });
  });

  it("reports nothing for a refused token or a good sweep", async () => {
    reportError.mockClear();
    sweepOrphanPhotos.mockResolvedValueOnce({ allowed: false });
    expect((await handleSweepMedia(post())).status).toBe(401);
    sweepOrphanPhotos.mockResolvedValueOnce({ allowed: true, removed: 3 });
    expect((await handleSweepMedia(post())).status).toBe(200);
    expect(reportError).not.toHaveBeenCalled();
  });
});
