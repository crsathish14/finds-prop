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
