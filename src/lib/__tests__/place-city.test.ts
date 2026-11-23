import { describe, expect, it } from "vitest";
import { cityFromPlaceDetail } from "../place-city";

describe("UT-place-city: the city of a map suggestion's address", () => {
  it("takes the part before the state, not the locality in front of it", () => {
    expect(cityFromPlaceDetail("Adyar, Chennai, Tamil Nadu 600020, India", "Tamil Nadu")).toBe(
      "Chennai",
    );
  });

  it("takes the first part when the address starts with the city", () => {
    expect(cityFromPlaceDetail("Chennai, Tamil Nadu, India", "Tamil Nadu")).toBe("Chennai");
  });

  it("takes the first part that is no country or number when there is no state", () => {
    expect(cityFromPlaceDetail("600020, Madurai, India", "Tamil Nadu")).toBe("Madurai");
  });

  it("gives nothing when the address names no city", () => {
    expect(cityFromPlaceDetail("Tamil Nadu, India", "Tamil Nadu")).toBeNull();
    expect(cityFromPlaceDetail("", "Tamil Nadu")).toBeNull();
  });
});
