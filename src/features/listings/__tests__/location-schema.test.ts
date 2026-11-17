import { describe, expect, it } from "vitest";
import { toFieldErrors } from "@/server/actions/field-errors";
import { setListingLocationSchema } from "../schemas";

const LISTING = "00000000-0000-4000-9000-00000000000A";

function problems(input: unknown) {
  const result = setListingLocationSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(
    Object.entries(toFieldErrors(result.error, input)).map(([path, list]) => [
      path,
      list.map((error) => error.key),
    ]),
  );
}

describe("UT-schemas: setting a listing's location (ADR-141)", () => {
  it("accepts a listing and a point, and lowers the listing id", () => {
    expect(
      setListingLocationSchema.parse({ listingId: LISTING, lat: 13.0827, lng: 80.2707 }),
    ).toEqual({
      listingId: LISTING.toLowerCase(),
      lat: 13.0827,
      lng: 80.2707,
    });
  });

  it("accepts the edges of the globe, and zero", () => {
    for (const [lat, lng] of [
      [90, 180],
      [-90, -180],
      [0, 0],
    ]) {
      expect(setListingLocationSchema.safeParse({ listingId: LISTING, lat, lng }).success).toBe(
        true,
      );
    }
  });

  it("refuses numbers outside the globe, with the key of an invalid value", () => {
    expect(problems({ listingId: LISTING, lat: 90.0001, lng: 80 })).toEqual({
      lat: ["validation.invalid"],
    });
    expect(problems({ listingId: LISTING, lat: 13, lng: -180.0001 })).toEqual({
      lng: ["validation.invalid"],
    });
    expect(problems({ listingId: LISTING, lat: 100, lng: 200 })).toEqual({
      lat: ["validation.invalid"],
      lng: ["validation.invalid"],
    });
  });

  it("refuses what is not a finite number", () => {
    for (const bad of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      "13",
      null,
      true,
      {},
    ]) {
      expect(
        setListingLocationSchema.safeParse({ listingId: LISTING, lat: bad, lng: 80 }).success,
      ).toBe(false);
      expect(
        setListingLocationSchema.safeParse({ listingId: LISTING, lat: 13, lng: bad }).success,
      ).toBe(false);
    }
  });

  it("needs both numbers and a listing id", () => {
    expect(problems({ listingId: LISTING, lat: 13 })).toHaveProperty("lng");
    expect(problems({ listingId: LISTING, lng: 80 })).toHaveProperty("lat");
    expect(problems({ lat: 13, lng: 80 })).toHaveProperty("listingId");
    expect(problems({ listingId: "not-an-id", lat: 13, lng: 80 })).toHaveProperty("listingId");
  });

  it("drops anything else the request carries: nobody says who owns the listing or what state it is in", () => {
    const parsed = setListingLocationSchema.parse({
      listingId: LISTING,
      lat: 13,
      lng: 80,
      ownerId: "someone",
      status: "approved",
      publicLocation: [1, 2],
    });
    expect(Object.keys(parsed).sort()).toEqual(["lat", "listingId", "lng"]);
  });
});
