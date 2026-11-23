import { describe, expect, it } from "vitest";
import { DRAFT_MAX_ANSWERS } from "@/lib/form-draft";
import type { PlaceAutocompleteSuggestion } from "@/types/places";
import {
  applyArea,
  applySuggestion,
  clearPlace,
  draftInput,
  EMPTY_VALUES,
  locationProblem,
  pickedPlace,
  pointKey,
  pointOf,
  stepOfField,
  stepsWithErrors,
  valuesFromDraft,
  type WizardValues,
} from "../wizard-state";
import type { DraftView } from "../view";

const street: PlaceAutocompleteSuggestion = {
  id: "s1",
  label: "Velachery Main Road",
  detail: "Velachery, Chennai, Tamil Nadu 600042, India",
  kind: "street",
  lat: 12.9815,
  lng: 80.2209,
};

const area: PlaceAutocompleteSuggestion = {
  id: "a1",
  label: "Adyar",
  detail: "Chennai, Tamil Nadu, India",
  kind: "area",
  lat: 13.0012,
  lng: 80.2565,
};

const empty: WizardValues = { ...EMPTY_VALUES, city: "" };

describe("UT-wizard-location: what a picked place fills, and what it never overwrites (ADR-141)", () => {
  it("keeps the point, the name and how exact it is, as text the draft keep can carry", () => {
    const after = applySuggestion(empty, street, { approximate: false });
    expect(after).toMatchObject({
      locationLat: "12.9815",
      locationLng: "80.2209",
      locationKind: "exact",
      locationLabel: "Velachery Main Road",
      locationDetail: "Velachery, Chennai, Tamil Nadu 600042, India",
    });
    expect(pointOf(after)).toEqual({ lat: 12.9815, lng: 80.2209 });
    expect(pickedPlace(after)).toEqual({
      label: "Velachery Main Road",
      detail: "Velachery, Chennai, Tamil Nadu 600042, India",
      approximate: false,
    });
  });

  it("fills the empty address with the name and the rest of the address, and the pincode that starts with 5 or 6", () => {
    const after = applySuggestion(empty, street, { approximate: false });
    expect(after.address).toBe("Velachery Main Road, Velachery, Chennai, Tamil Nadu 600042, India");
    expect(after.pincode).toBe("600042");
  });

  it("fills the city with the first part of the address that is not the state", () => {
    expect(applySuggestion(empty, street, { approximate: false }).city).toBe("Velachery");
    expect(applySuggestion(empty, area, { approximate: true }).city).toBe("Chennai");
    // The state, the country and bare numbers are not cities.
    const odd = { ...area, detail: "Tamil Nadu 600042, India, 600042, Madurai" };
    expect(applySuggestion(empty, odd, { approximate: true }).city).toBe("Madurai");
    const none = { ...area, detail: "Tamil Nadu, India" };
    expect(applySuggestion(empty, none, { approximate: true }).city).toBe("");
  });

  it("fills the locality only when the place is an area", () => {
    expect(applySuggestion(empty, street, { approximate: false }).locality).toBe("");
    expect(applySuggestion(empty, area, { approximate: true }).locality).toBe("Adyar");
  });

  it("takes only a six-digit number that starts with 5 or 6, standing alone", () => {
    const pin = (detail: string) =>
      applySuggestion(empty, { ...street, detail }, { approximate: false }).pincode;
    expect(pin("Chennai 400001, Tamil Nadu")).toBe("");
    expect(pin("Madurai, 625001 India")).toBe("625001");
    expect(pin("Chennai 6000421")).toBe("");
    expect(pin("Chennai 16000")).toBe("");
    expect(pin("Phone 9876543210, Chennai 600042")).toBe("600042");
    expect(pin("Chennai 500001 and 600042")).toBe("500001");
  });

  it("never overwrites a box that has something in it", () => {
    const typed: WizardValues = {
      ...EMPTY_VALUES,
      address: "12, Second Cross Street",
      locality: "Velachery East",
      city: "Chengalpattu",
      pincode: "603202",
    };
    const after = applySuggestion(typed, area, { approximate: true });
    expect(after.address).toBe("12, Second Cross Street");
    expect(after.locality).toBe("Velachery East");
    expect(after.city).toBe("Chengalpattu");
    expect(after.pincode).toBe("603202");
    // The point is still kept.
    expect(after.locationLat).toBe("13.0012");
  });

  it("counts a box of spaces as empty", () => {
    const after = applySuggestion(
      { ...EMPTY_VALUES, address: "   ", locality: " ", pincode: "  " },
      { ...area, detail: "Chennai 600042, Tamil Nadu" },
      { approximate: true },
    );
    expect(after.address).toBe("Adyar, Chennai 600042, Tamil Nadu");
    expect(after.locality).toBe("Adyar");
    expect(after.pincode).toBe("600042");
  });

  it("treats the City box as empty only while it still holds the starting value nobody typed over", () => {
    expect(EMPTY_VALUES.city).toBe("Chennai");
    const madurai = { ...area, detail: "Madurai, Tamil Nadu, India" };
    // The starting value is not the owner's answer.
    expect(
      applySuggestion(EMPTY_VALUES, madurai, { approximate: true, cityUntouched: true }).city,
    ).toBe("Madurai");
    // Typed (or saved), "Chennai" is an answer and stays.
    expect(applySuggestion(EMPTY_VALUES, madurai, { approximate: true }).city).toBe("Chennai");
    // And a different typed city is never replaced, flag or not.
    expect(
      applySuggestion({ ...EMPTY_VALUES, city: "Salem" }, madurai, {
        approximate: true,
        cityUntouched: false,
      }).city,
    ).toBe("Salem");
  });

  it("cuts what it writes to the limits of the boxes", () => {
    const long = { ...area, label: "A".repeat(200), detail: "B".repeat(400) };
    const after = applySuggestion(empty, long, { approximate: true });
    expect(after.address.length).toBeLessThanOrEqual(300);
    expect(after.locality.length).toBeLessThanOrEqual(80);
    expect(after.city.length).toBeLessThanOrEqual(80);
  });

  it("holds an area as approximate, whatever the kind said", () => {
    const after = applySuggestion(empty, area, { approximate: true });
    expect(after.locationKind).toBe("approximate");
    expect(pickedPlace(after)?.approximate).toBe(true);
  });

  it("a curated area is the middle of the area: approximate, locality filled while empty, nothing else touched", () => {
    const velachery = { label: "Velachery", lat: 12.9791, lng: 80.2184 };
    const after = applyArea({ ...EMPTY_VALUES }, velachery);
    expect(after).toMatchObject({
      locationLat: "12.9791",
      locationLng: "80.2184",
      locationKind: "approximate",
      locationLabel: "Velachery",
      locality: "Velachery",
      address: "",
      pincode: "",
      city: "Chennai",
    });
    const typed = applyArea({ ...EMPTY_VALUES, locality: "Velachery East" }, velachery);
    expect(typed.locality).toBe("Velachery East");
  });

  it("Change lets go of the place and nothing else", () => {
    const placed = applySuggestion(empty, street, { approximate: false });
    const cleared = clearPlace(placed);
    expect(pointOf(cleared)).toBeNull();
    expect(pickedPlace(cleared)).toBeNull();
    expect(cleared.locationKind).toBe("");
    expect(cleared.address).toBe(placed.address);
    expect(cleared.pincode).toBe(placed.pincode);
  });
});

describe("UT-wizard-location: the point as text", () => {
  it("is held only as a finite pair, and the key tells a changed point from the same one", () => {
    const placed = applySuggestion(empty, street, { approximate: false });
    expect(pointKey(placed)).toBe("12.9815,80.2209");
    expect(pointKey({ ...placed, locationLat: "13" })).toBe("13,80.2209");
    expect(pointOf({ ...EMPTY_VALUES })).toBeNull();
    expect(pointOf({ ...placed, locationLat: "not a number" })).toBeNull();
    expect(pointOf({ ...placed, locationLng: "" })).toBeNull();
    expect(pointKey({ ...placed, locationLat: "Infinity" })).toBeNull();
  });

  it("is never one of the draft's fields: the point goes to its own action", () => {
    const placed = applySuggestion(empty, street, { approximate: false });
    for (const steps of [[1], [1, 2], [1, 2, 4]] as const) {
      const input = draftInput(placed, steps);
      expect(Object.keys(input).filter((key) => key.startsWith("location"))).toEqual([]);
      expect(JSON.stringify(input)).not.toContain("12.9815");
    }
  });

  it("fits in the answers kept before signing in again, with the other boxes", () => {
    expect(Object.keys(EMPTY_VALUES).length).toBeLessThanOrEqual(DRAFT_MAX_ANSWERS);
  });

  it("is never read from a stored listing: an opened draft starts with no point", () => {
    const view: DraftView = {
      id: "00000000-0000-4000-9000-000000000001",
      shortId: "abcd2345",
      status: "draft",
      rejectionReason: null,
      listingType: "sale",
      propertyType: "apartment",
      address: "1 Beach Road",
      locality: "Adyar",
      city: "Chennai",
      pincode: "600020",
      bhk: null,
      bathrooms: null,
      areaSqft: null,
      price: null,
      furnishing: null,
      amenities: [],
      title: null,
      description: null,
      updatedAt: "2026-11-07T10:00:00Z",
      photos: [],
      hasLocation: true,
    };
    const values = valuesFromDraft(view);
    expect(pointOf(values)).toBeNull();
    expect(values.locationKind).toBe("");
  });
});

describe("UT-wizard-location: Continue needs a place", () => {
  it("asks for one when none is picked and none is held, on the address step", () => {
    expect(locationProblem(EMPTY_VALUES, false)).toEqual({
      location: { key: "validation.required" },
    });
    expect(stepOfField("location")).toBe(1);
    expect(stepsWithErrors(locationProblem(EMPTY_VALUES, false))).toEqual([1]);
  });

  it("is satisfied by a place picked now, or by one the listing already holds", () => {
    const placed = applySuggestion(empty, street, { approximate: false });
    expect(locationProblem(placed, false)).toEqual({});
    expect(locationProblem(EMPTY_VALUES, true)).toEqual({});
  });

  it("is not satisfied by a half point", () => {
    expect(locationProblem({ ...EMPTY_VALUES, locationLat: "12.9" }, false)).not.toEqual({});
  });
});
