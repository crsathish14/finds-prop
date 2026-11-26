import { describe, expect, it } from "vitest";
import { queueHref } from "../href";
import { afterDecision, decisionsFor, matchesTab, uniqueById } from "../rows";
import { loadMoreSchema } from "../schemas";

describe("UT-moderation-rows: which tab a listing belongs on (S6-T04)", () => {
  it.each([
    ["pending", "pending", true],
    ["pending", "approved", false],
    ["approved", "approved", true],
    ["rejected", "rejected", true],
    ["rejected", "pending", false],
    ["closed", "sold", true],
    ["closed", "rented", true],
    ["closed", "approved", false],
    ["all", "pending", true],
    ["all", "rented", true],
  ] as const)("the %s tab and a %s listing: %s", (tab, status, shown) => {
    expect(matchesTab(tab, status)).toBe(shown);
  });
});

const NO_DAYS = { featuredFrom: null, featuredUntil: null };

describe("UT-moderation-rows: what a decision leaves behind", () => {
  it("approving makes it approved and keeps the featured flag", () => {
    expect(afterDecision("approve", { status: "pending", featured: false, ...NO_DAYS })).toEqual({
      status: "approved",
      featured: false,
      ...NO_DAYS,
    });
  });

  it("rejecting makes it rejected and never featured", () => {
    expect(afterDecision("reject", { status: "pending", featured: false, ...NO_DAYS })).toEqual({
      status: "rejected",
      featured: false,
      ...NO_DAYS,
    });
  });

  it("featuring and removing from featured change only the flag", () => {
    expect(afterDecision("feature", { status: "approved", featured: false, ...NO_DAYS })).toEqual({
      status: "approved",
      featured: true,
      ...NO_DAYS,
    });
    expect(afterDecision("unfeature", { status: "approved", featured: true, ...NO_DAYS })).toEqual({
      status: "approved",
      featured: false,
      ...NO_DAYS,
    });
  });

  it("featuring with dates (ADR-210) takes the switch the database answered and the days sent", () => {
    expect(
      afterDecision(
        "feature",
        { status: "approved", featured: false, ...NO_DAYS },
        { featured: false, featuredFrom: "2026-12-01", featuredUntil: "2026-12-31" },
      ),
    ).toEqual({
      status: "approved",
      featured: false,
      featuredFrom: "2026-12-01",
      featuredUntil: "2026-12-31",
    });
  });

  it("removing from featured also clears the days", () => {
    expect(
      afterDecision("unfeature", {
        status: "approved",
        featured: false,
        featuredFrom: "2026-01-01",
        featuredUntil: "2026-01-31",
      }),
    ).toEqual({ status: "approved", featured: false, ...NO_DAYS });
  });

  it.each([
    ["pending", false, ["approve", "reject"]],
    ["approved", false, ["feature"]],
    ["approved", true, ["unfeature"]],
    ["rejected", false, []],
    ["sold", false, []],
    ["rented", false, []],
  ] as const)("a %s listing (featured: %s) offers %j", (status, featured, decisions) => {
    expect(decisionsFor(status, { featured, ...NO_DAYS })).toEqual(decisions);
  });

  it.each([
    ["scheduled", { featured: false, featuredFrom: "2999-01-01", featuredUntil: null }],
    ["running", { featured: true, featuredFrom: "2020-01-01", featuredUntil: null }],
    ["ended", { featured: false, featuredFrom: null, featuredUntil: "2020-01-31" }],
  ] as const)(
    "an approved listing whose Featured is %s offers Feature (new dates) and Remove from featured",
    (_status, state) => {
      expect(decisionsFor("approved", state)).toEqual(["feature", "unfeature"]);
    },
  );

  it("a pending listing with old dates still offers only approve and reject", () => {
    expect(
      decisionsFor("pending", { featured: false, featuredFrom: "2020-01-01", featuredUntil: null }),
    ).toEqual(["approve", "reject"]);
  });
});

describe("UT-moderation-rows: no row twice", () => {
  it("keeps the first of each id, in order", () => {
    expect(
      uniqueById([
        { id: "a", value: 1 },
        { id: "b", value: 2 },
        { id: "a", value: 3 },
      ]),
    ).toEqual([
      { id: "a", value: 1 },
      { id: "b", value: 2 },
    ]);
  });
});

describe("UT-moderation-href: the queue's address (R-FE-11)", () => {
  it("leaves out what is the default", () => {
    expect(queueHref({ tab: "pending" })).toBe("/admin/listings");
  });

  it("names the tab, the locality and the kind when they are not the default", () => {
    expect(queueHref({ tab: "closed", locality: "Adyar", kind: "rent" })).toBe(
      "/admin/listings?tab=closed&locality=Adyar&kind=rent",
    );
    expect(queueHref({ tab: "pending", kind: "sale" })).toBe("/admin/listings?kind=sale");
  });

  it("encodes a locality with spaces and symbols", () => {
    expect(queueHref({ tab: "pending", locality: "OMR & Sholinganallur" })).toBe(
      "/admin/listings?locality=OMR+%26+Sholinganallur",
    );
  });
});

describe("UT-moderation-schemas: Show more fails instead of falling back", () => {
  const CURSOR = "abc";

  it("accepts the filters and a cursor", () => {
    expect(
      loadMoreSchema.safeParse({ tab: "all", locality: "Adyar", kind: "sale", after: CURSOR })
        .success,
    ).toBe(true);
  });

  it.each([
    { tab: "drafts", after: CURSOR },
    { tab: "all" },
    { tab: "all", after: "" },
    { tab: "all", after: CURSOR, kind: "lease" },
    { tab: "all", after: CURSOR, locality: "" },
  ])("refuses %j", (input) => {
    expect(loadMoreSchema.safeParse(input).success).toBe(false);
  });
});
