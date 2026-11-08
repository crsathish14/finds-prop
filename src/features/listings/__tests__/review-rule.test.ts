import { describe, expect, it } from "vitest";
import { changedModeratedFields, changesNeedReview, MODERATED_FIELDS } from "../review-rule";

const before = {
  listingType: "sale",
  propertyType: "apartment",
  title: "Flat in Adyar near the beach",
  description: "A bright flat.\nSecond line.",
  address: "12 Beach Road",
};

describe("review rule: which edits send a Live listing back to review (S6-T05, DEC-09)", () => {
  it("names the five moderated fields", () => {
    expect([...MODERATED_FIELDS]).toEqual([
      "listingType",
      "propertyType",
      "title",
      "description",
      "address",
    ]);
  });

  it("finds each moderated field that changed, and only those", () => {
    expect(changedModeratedFields(before, before)).toEqual([]);
    expect(
      changedModeratedFields(before, { ...before, title: "A new title for the flat" }),
    ).toEqual(["title"]);
    expect(
      changedModeratedFields(before, { ...before, address: "14 Beach Road", listingType: "rent" }),
    ).toEqual(["listingType", "address"]);
  });

  it("ignores what the database would not keep: spacing at the ends and in runs, and blank against nothing", () => {
    expect(
      changedModeratedFields(before, {
        ...before,
        title: "  Flat in Adyar   near the beach ",
        address: "12  Beach Road ",
        description: "A bright flat.\nSecond line.  ",
      }),
    ).toEqual([]);
    expect(
      changedModeratedFields({ ...before, description: null }, { ...before, description: "   " }),
    ).toEqual([]);
  });

  it("sees a line break that was added, because the description keeps them", () => {
    expect(
      changedModeratedFields(before, { ...before, description: "A bright flat. Second line." }),
    ).toEqual(["description"]);
  });

  it("treats a field that is not given as unchanged only when the listing has nothing there", () => {
    expect(changedModeratedFields({ title: "A title" }, {})).toEqual(["title"]);
    expect(changedModeratedFields({}, {})).toEqual([]);
  });

  it("sends only a Live listing back, and only for a moderated change", () => {
    const edited = { ...before, title: "A different title for the flat" };
    expect(changesNeedReview("approved", before, edited)).toBe(true);
    expect(changesNeedReview("approved", before, before)).toBe(false);
    for (const status of ["draft", "pending", "rejected", "sold", "rented"] as const) {
      expect(changesNeedReview(status, before, edited)).toBe(false);
    }
  });
});
