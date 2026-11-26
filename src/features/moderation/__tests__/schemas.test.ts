import { describe, expect, it } from "vitest";
import { REASON_MAX } from "../constants";
import { moderateListingSchema, queueFilterSchema } from "../schemas";

const LISTING = "00000000-0000-4000-9000-000000000001";

describe("UT-moderation-schemas: the decision (S6-T04)", () => {
  it.each(["approve", "feature", "unfeature"] as const)(
    "accepts %s with only the listing",
    (decision) => {
      const parsed = moderateListingSchema.safeParse({ decision, listingId: LISTING });
      expect(parsed.success).toBe(true);
    },
  );

  it("accepts a feature with a start date, an end date, both, or blanks (ADR-210)", () => {
    expect(
      moderateListingSchema.parse({
        decision: "feature",
        listingId: LISTING,
        featuredFrom: "2026-12-01",
        featuredUntil: "2026-12-31",
      }),
    ).toEqual({
      decision: "feature",
      listingId: LISTING,
      featuredFrom: "2026-12-01",
      featuredUntil: "2026-12-31",
    });
    expect(
      moderateListingSchema.parse({
        decision: "feature",
        listingId: LISTING,
        featuredFrom: "",
        featuredUntil: "  ",
      }),
    ).toEqual({ decision: "feature", listingId: LISTING });
    expect(
      moderateListingSchema.safeParse({
        decision: "feature",
        listingId: LISTING,
        featuredFrom: "2026-12-01",
        featuredUntil: "2026-12-01",
      }).success,
    ).toBe(true);
  });

  it.each(["2026-02-30", "2026-13-01", "01-12-2026", "tomorrow", 20261201])(
    "refuses a feature date that is not a real day: %j",
    (day) => {
      const parsed = moderateListingSchema.safeParse({
        decision: "feature",
        listingId: LISTING,
        featuredFrom: day,
      });
      expect(parsed.success).toBe(false);
    },
  );

  it("refuses an end date before the start date, on the end date, with the approved words", () => {
    const parsed = moderateListingSchema.safeParse({
      decision: "feature",
      listingId: LISTING,
      featuredFrom: "2026-12-10",
      featuredUntil: "2026-12-09",
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({
        path: ["featuredUntil"],
        message: "validation.promotionDatesOrder",
      }),
    ]);
  });

  it("drops dates sent with any decision but a feature", () => {
    expect(
      moderateListingSchema.parse({
        decision: "unfeature",
        listingId: LISTING,
        featuredFrom: "2026-12-01",
      }),
    ).toEqual({ decision: "unfeature", listingId: LISTING });
  });

  it("drops a reason sent with an approval, so it can never be stored", () => {
    const parsed = moderateListingSchema.parse({
      decision: "approve",
      listingId: LISTING,
      reason: "x",
    });
    expect(parsed).toEqual({ decision: "approve", listingId: LISTING });
  });

  it("trims a rejection's reason and keeps it", () => {
    const parsed = moderateListingSchema.parse({
      decision: "reject",
      listingId: LISTING,
      reason: "  Photos are not of the home.  ",
    });
    expect(parsed).toMatchObject({ reason: "Photos are not of the home." });
  });

  it.each([undefined, "", "   ", "\n\t"])("refuses a rejection with the reason %j", (reason) => {
    const parsed = moderateListingSchema.safeParse({
      decision: "reject",
      listingId: LISTING,
      reason,
    });
    expect(parsed.success).toBe(false);
  });

  it(`accepts a reason of ${REASON_MAX} characters and refuses one of ${REASON_MAX + 1}`, () => {
    const fits = moderateListingSchema.safeParse({
      decision: "reject",
      listingId: LISTING,
      reason: "a".repeat(REASON_MAX),
    });
    const tooLong = moderateListingSchema.safeParse({
      decision: "reject",
      listingId: LISTING,
      reason: "a".repeat(REASON_MAX + 1),
    });
    expect(fits.success).toBe(true);
    expect(tooLong.success).toBe(false);
  });

  it("counts the length after trimming, as the database does", () => {
    const parsed = moderateListingSchema.safeParse({
      decision: "reject",
      listingId: LISTING,
      reason: `  ${"a".repeat(REASON_MAX)}  `,
    });
    expect(parsed.success).toBe(true);
  });

  it.each([
    {},
    { decision: "delete", listingId: LISTING },
    { decision: "approve" },
    { decision: "approve", listingId: "nope" },
  ])("refuses %j", (input) => {
    expect(moderateListingSchema.safeParse(input).success).toBe(false);
  });
});

describe("UT-moderation-schemas: the queue's address bar (S6-T04, R-FE-11)", () => {
  it("defaults to the pending tab with no filters", () => {
    expect(queueFilterSchema.parse({})).toEqual({ tab: "pending" });
  });

  it("reads a valid tab, locality and kind", () => {
    expect(queueFilterSchema.parse({ tab: "closed", locality: "Adyar", kind: "rent" })).toEqual({
      tab: "closed",
      locality: "Adyar",
      kind: "rent",
    });
  });

  it("drops what is not valid instead of failing", () => {
    expect(
      queueFilterSchema.parse({ tab: "drafts", kind: "lease", locality: "", after: "" }),
    ).toEqual({
      tab: "pending",
    });
  });

  it("takes the first of a repeated value and ignores a non-text one", () => {
    expect(queueFilterSchema.parse({ tab: ["approved", "rejected"], locality: 7 })).toEqual({
      tab: "approved",
    });
  });

  it("drops a locality that is too long", () => {
    expect(queueFilterSchema.parse({ locality: "a".repeat(81) })).toEqual({ tab: "pending" });
  });
});
