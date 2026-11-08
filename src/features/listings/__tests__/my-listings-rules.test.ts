import { describe, expect, it } from "vitest";
import {
  ageInDays,
  editHref,
  outcomeFor,
  ownerActions,
  statusAfterClose,
} from "../my-listings-rules";

describe("ownerActions: the buttons a listing offers by its state (S6-T03)", () => {
  it("lets a listing in review, Live or not approved be edited, only a Live one be closed, and any be deleted", () => {
    expect(ownerActions("approved")).toEqual(["edit", "close", "delete"]);
    expect(ownerActions("pending")).toEqual(["edit", "delete"]);
    expect(ownerActions("rejected")).toEqual(["edit", "delete"]);
    expect(ownerActions("sold")).toEqual(["delete"]);
    expect(ownerActions("rented")).toEqual(["delete"]);
  });
});

describe("outcomeFor: how a listing is closed", () => {
  it("is sold for a sale and rented for a rental, and nothing without a kind", () => {
    expect(outcomeFor("sale")).toBe("sold");
    expect(outcomeFor("rent")).toBe("rented");
    expect(outcomeFor(null)).toBeNull();
  });

  it("is the state the row shows until the page is read again", () => {
    expect(statusAfterClose("sold")).toBe("sold");
    expect(statusAfterClose("rented")).toBe("rented");
  });
});

describe("ageInDays: how long ago a listing was posted", () => {
  const NOW = Date.parse("2026-11-08T10:00:00Z");

  it("counts whole days", () => {
    expect(ageInDays("2026-11-06T09:00:00Z", NOW)).toBe(2);
    expect(ageInDays("2026-11-08T01:00:00Z", NOW)).toBe(0);
  });

  it("is never negative when a clock is ahead, and 0 for a time that is not a date", () => {
    expect(ageInDays("2026-11-09T10:00:00Z", NOW)).toBe(0);
    expect(ageInDays("not a date", NOW)).toBe(0);
  });
});

describe("editHref: where a listing is edited (S6-T05)", () => {
  it("is the wizard opened on that listing", () => {
    expect(editHref("00000000-0000-4000-9000-000000000001")).toBe(
      "/post-property/00000000-0000-4000-9000-000000000001",
    );
  });
});
