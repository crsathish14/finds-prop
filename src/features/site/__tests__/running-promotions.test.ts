import { describe, expect, it } from "vitest";
import { SITE_DEFAULTS } from "../defaults";
import { runningPromotions } from "../running-promotions";

const ALPHA = "00000000-0000-4000-8000-00000000000a";
const BETA = "00000000-0000-4000-8000-00000000000b";
const GAMMA = "00000000-0000-4000-8000-00000000000c";
const today = "2026-11-26";

describe("UT-running-promotions: the public read keeps what runs today (ADR-210)", () => {
  it("leaves out the dated picks that are not running, keeps the undated and the running", () => {
    const settings = {
      ...SITE_DEFAULTS,
      sponsored_builders: {
        featured: [ALPHA, BETA, GAMMA],
        spotlight: [ALPHA, BETA],
        featuredDates: { [ALPHA]: { startsOn: "2026-12-01" }, [BETA]: { endsOn: "2026-11-30" } },
        spotlightDates: { [BETA]: { endsOn: "2026-11-25" } },
      },
      top_developers: { builderIds: [ALPHA, GAMMA], dates: { [GAMMA]: { endsOn: "2026-11-01" } } },
    };
    const running = runningPromotions(settings, today);
    expect(running.sponsored_builders.featured).toEqual([BETA, GAMMA]);
    expect(running.sponsored_builders.spotlight).toEqual([ALPHA]);
    expect(running.top_developers.builderIds).toEqual([ALPHA]);
  });

  it("leaves out a sponsor ad whose dates are not today, and keeps ads saved before the dates", () => {
    const settings = {
      ...SITE_DEFAULTS,
      sponsors: {
        ads: [
          { id: "old" },
          { id: "later", startsOn: "2026-12-01" },
          { id: "over", endsOn: "2026-11-25" },
          { id: "now", startsOn: "2026-11-26", endsOn: "2026-11-26" },
          "not an ad",
        ],
      },
    };
    const ids = runningPromotions(settings, today).sponsors.ads.map((ad) =>
      typeof ad === "object" && ad !== null ? (ad as { id: string }).id : ad,
    );
    expect(ids).toEqual(["old", "now", "not an ad"]);
  });

  it("changes nothing when no promotion has dates", () => {
    expect(runningPromotions(SITE_DEFAULTS, today)).toEqual(SITE_DEFAULTS);
  });
});
