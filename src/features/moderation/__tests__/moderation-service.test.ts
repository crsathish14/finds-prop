import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { decideListing, mapModerationError, type ModerationStore } from "../moderation-service";

const LISTING = "00000000-0000-4000-9000-000000000001";
const done = { listingId: LISTING, shortId: "abcd2345", status: "approved", featured: false };

describe("UT-moderation-service: the database's answers as action errors (S6-T04)", () => {
  it.each([
    [{ message: "listing.not_reviewable", code: "55000" }, "CONFLICT"],
    [{ message: "listing.not_featurable", code: "55000" }, "CONFLICT"],
    [{ message: "listing.reason_required", code: "23514" }, "VALIDATION"],
    [{ message: "listing.not_found", code: "P0002" }, "NOT_FOUND"],
    [{ message: "listing.not_allowed", code: "42501" }, "FORBIDDEN"],
    [{ message: "listing.bad_action", code: "22023" }, "VALIDATION"],
    [{ message: "something else", code: "XX000" }, "INTERNAL"],
    [{}, "INTERNAL"],
  ])("maps %j to %s", (failure, code) => {
    const error = mapModerationError(failure);
    expect(error).toBeInstanceOf(ActionError);
    expect(error.code).toBe(code);
  });

  it("puts a missing reason on the reason field", () => {
    expect(mapModerationError({ message: "listing.reason_required" }).fieldErrors).toEqual({
      reason: [{ key: "validation.required" }],
    });
  });

  it("never repeats the database's text to the caller", () => {
    expect(mapModerationError({ message: "listing.not_reviewable" }).message).not.toMatch(
      /listing\./,
    );
  });

  it("sends the reason only with a rejection", async () => {
    const decide = vi.fn<ModerationStore["decide"]>().mockResolvedValue(done);
    const store: ModerationStore = { decide };
    await decideListing(store, {
      decision: "reject",
      listingId: LISTING,
      reason: "No photos of the home.",
    });
    await decideListing(store, { decision: "approve", listingId: LISTING });
    await decideListing(store, { decision: "feature", listingId: LISTING });
    await decideListing(store, { decision: "unfeature", listingId: LISTING });
    expect(decide.mock.calls).toEqual([
      [LISTING, "reject", "No photos of the home."],
      [LISTING, "approve", null],
      [LISTING, "feature", null],
      [LISTING, "unfeature", null],
    ]);
  });

  it("lets the database's refusal through unchanged", async () => {
    const store: ModerationStore = {
      decide: () => Promise.reject(mapModerationError({ message: "listing.not_reviewable" })),
    };
    await expect(
      decideListing(store, { decision: "approve", listingId: LISTING }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
