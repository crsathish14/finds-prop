import { describe, expect, it, vi } from "vitest";
import { trackSponsorEventConfig } from "../action-config";
import { trackSponsorEventSchema } from "../event-schemas";
import { recordSponsorEvent, type LiveSponsors } from "../event-service";

const LIVE: LiveSponsors = {
  hero: new Set(["ad-1"]),
  results: new Set(["b1"]),
  spotlight: new Set(["b2"]),
};
const VISITOR = "a".repeat(40);

describe("UT-sponsor-event: counting a paid placement (ADR-194)", () => {
  it("counts a live sponsor, and says whether it was a first that day", async () => {
    const store = { record: vi.fn(async () => true) };
    const click = { slot: "results", key: "b1", kind: "click", visitor: VISITOR } as const;
    expect(await recordSponsorEvent(store, LIVE, click)).toEqual({ counted: true });
    expect(store.record).toHaveBeenCalledWith(click);
    store.record.mockResolvedValueOnce(false);
    const view = { slot: "hero", key: "ad-1", kind: "view", visitor: VISITOR } as const;
    expect(await recordSponsorEvent(store, LIVE, view)).toEqual({ counted: false });
  });

  it("counts nothing for a sponsor that is not live in that placement", async () => {
    const store = { record: vi.fn(async () => true) };
    for (const [slot, key] of [
      ["hero", "ad-gone"],
      ["results", "b2"],
      ["spotlight", "b1"],
    ] as const) {
      const row = { slot, key, kind: "view", visitor: VISITOR } as const;
      expect(await recordSponsorEvent(store, LIVE, row)).toEqual({ counted: false });
    }
    expect(store.record).not.toHaveBeenCalled();
  });

  it("is open to visitors, rate limited, and takes only a placement, a sponsor and view or click", () => {
    const ok = (input: unknown) => trackSponsorEventSchema.safeParse(input).success;
    expect(trackSponsorEventConfig.auth).toBe("none");
    expect(trackSponsorEventConfig.rateLimit.scope).toBe("sponsor_event");
    expect(ok({ slot: "hero", key: "ad-1", kind: "view" })).toBe(true);
    expect(ok({ slot: "footer", key: "ad-1", kind: "view" })).toBe(false);
    expect(ok({ slot: "hero", key: " ", kind: "view" })).toBe(false);
    expect(ok({ slot: "hero", key: "x".repeat(81), kind: "view" })).toBe(false);
    expect(ok({ slot: "hero", key: "ad-1", kind: "hover" })).toBe(false);
  });
});
