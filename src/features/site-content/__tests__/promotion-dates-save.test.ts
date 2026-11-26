import { describe, expect, it } from "vitest";
import { SITE_DEFAULTS } from "@/features/site/defaults";
import {
  datesFor,
  saveSponsoredBuildersContent,
  saveTopDevelopersContent,
  type ContentStore,
} from "../content-service";
import { sponsoredBuildersInputSchema, topDevelopersInputSchema } from "../schemas";
import { sponsorsInputSchema } from "../sponsor-schemas";

const ALPHA = "00000000-0000-4000-8000-00000000000a";
const BETA = "00000000-0000-4000-8000-00000000000b";

function fakeStore() {
  const writes: { key: string; value: Record<string, unknown> }[] = [];
  const store: ContentStore = {
    write: (key, value) => {
      writes.push({ key, value });
      return Promise.resolve();
    },
    readBounds: () => Promise.resolve(SITE_DEFAULTS.region.bounds),
  };
  return { store, writes };
}

describe("UT-promotion-dates-save: the dates the admin saves (ADR-210)", () => {
  it("reads empty boxes as no day and refuses a day that is not real", () => {
    const parsed = topDevelopersInputSchema.parse({
      builderIds: [ALPHA],
      dates: { [ALPHA]: { startsOn: "", endsOn: "2026-12-31" } },
    });
    expect(parsed.dates?.[ALPHA]).toEqual({ endsOn: "2026-12-31" });
    const bad = topDevelopersInputSchema.safeParse({
      builderIds: [ALPHA],
      dates: { [ALPHA]: { startsOn: "2026-02-31", endsOn: "" } },
    });
    expect(bad.error?.issues[0]).toMatchObject({
      path: ["dates", ALPHA, "startsOn"],
      message: "validation.invalid",
    });
  });

  it("refuses an end date before the start date, on the end date's box", () => {
    const parsed = sponsoredBuildersInputSchema.safeParse({
      featured: [ALPHA],
      spotlight: [],
      featuredDates: { [ALPHA]: { startsOn: "2026-12-10", endsOn: "2026-12-01" } },
    });
    expect(parsed.error?.issues[0]).toMatchObject({
      path: ["featuredDates", ALPHA, "endsOn"],
      message: "validation.promotionDatesOrder",
    });
    const ad = sponsorsInputSchema.safeParse({
      sponsors: [
        {
          id: "s1",
          advertiser: "Kadal Homes",
          alt: "Kadal Vista towers",
          link: "url",
          href: "https://kadal.example",
          active: true,
          startsOn: "2026-12-10",
          endsOn: "2026-12-01",
        },
      ],
    });
    expect(ad.error?.issues[0]).toMatchObject({
      path: ["sponsors", 0, "endsOn"],
      message: "validation.promotionDatesOrder",
    });
  });

  it("keeps dates only for picks still in the list, and only the days given", () => {
    expect(
      datesFor([ALPHA], { [ALPHA]: { startsOn: "2026-12-01" }, [BETA]: { endsOn: "2026-12-31" } }),
    ).toEqual({ [ALPHA]: { startsOn: "2026-12-01" } });
    expect(datesFor([ALPHA], { [ALPHA]: {} })).toEqual({});
  });

  it("stores the lists with their dates", async () => {
    const { store, writes } = fakeStore();
    await saveSponsoredBuildersContent(store, {
      featured: [ALPHA],
      spotlight: [BETA],
      featuredDates: { [ALPHA]: { endsOn: "2026-12-31" } },
    });
    await saveTopDevelopersContent(store, { builderIds: [BETA], dates: {} });
    expect(writes).toEqual([
      {
        key: "sponsored_builders",
        value: {
          featured: [ALPHA],
          spotlight: [BETA],
          featuredDates: { [ALPHA]: { endsOn: "2026-12-31" } },
          spotlightDates: {},
        },
      },
      { key: "top_developers", value: { builderIds: [BETA], dates: {} } },
    ]);
  });
});
