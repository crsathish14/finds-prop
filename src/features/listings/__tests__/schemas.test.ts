import { describe, expect, it } from "vitest";
import { toFieldErrors } from "@/server/actions/field-errors";
import {
  basicsStepSchema,
  createDraftSchema,
  descriptionStepSchema,
  detailsStepSchema,
  draftFieldsSchema,
  saveDraftSchema,
  submitListingSchema,
} from "../schemas";

const LISTING = "00000000-0000-4000-9000-000000000001";
const KEY = "00000000-0000-4000-8000-000000000001";

function keysOf(result: { success: boolean; error?: unknown }, data?: unknown) {
  if (result.success) return {};
  const errors = toFieldErrors(result.error as never, data);
  return Object.fromEntries(
    Object.entries(errors).map(([path, list]) => [path, list.map((error) => error.key)]),
  );
}

const basics = {
  listingType: "sale",
  propertyType: "apartment",
  address: "12, Second Cross Street, Velachery",
  locality: "Velachery",
  city: "Chennai",
  pincode: "600042",
};

describe("UT-schemas: the post-property wizard's inputs (S6-T02, FR-ACC-06)", () => {
  describe("step 1, Basics", () => {
    it("accepts a complete step and tidies the text", () => {
      const parsed = basicsStepSchema.parse({
        ...basics,
        address: "  12,   Second Cross Street ",
        locality: " Velachery ",
      });
      expect(parsed.address).toBe("12, Second Cross Street");
      expect(parsed.locality).toBe("Velachery");
    });

    it("asks for the street or building, with its own message", () => {
      expect(keysOf(basicsStepSchema.safeParse({ ...basics, address: "   " }))).toEqual({
        address: ["validation.addressRequired"],
      });
      expect(keysOf(basicsStepSchema.safeParse({ ...basics, address: undefined }))).toEqual({
        address: ["validation.addressRequired"],
      });
    });

    it("needs a six-digit pincode that does not start with 0", () => {
      for (const bad of ["6000", "060042", "6000421", "abcdef", ""]) {
        expect(keysOf(basicsStepSchema.safeParse({ ...basics, pincode: bad }))).toEqual({
          pincode: ["validation.pincodeInvalid"],
        });
      }
    });

    it("limits the address to 300 and the locality to 2 to 80 characters", () => {
      expect(basicsStepSchema.safeParse({ ...basics, address: "a".repeat(300) }).success).toBe(
        true,
      );
      expect(keysOf(basicsStepSchema.safeParse({ ...basics, address: "a".repeat(301) }))).toEqual({
        address: ["validation.tooLong"],
      });
      expect(keysOf(basicsStepSchema.safeParse({ ...basics, locality: "A" }))).toEqual({
        locality: ["validation.tooShort"],
      });
      expect(keysOf(basicsStepSchema.safeParse({ ...basics, locality: "a".repeat(81) }))).toEqual({
        locality: ["validation.tooLong"],
      });
    });

    it("refuses a listing type or property type that is not on the list, and control characters", () => {
      expect(basicsStepSchema.safeParse({ ...basics, listingType: "lease" }).success).toBe(false);
      expect(basicsStepSchema.safeParse({ ...basics, propertyType: "castle" }).success).toBe(false);
      expect(basicsStepSchema.safeParse({ ...basics, city: "Chen\u0000nai" }).success).toBe(false);
    });
  });

  describe("step 2, Details", () => {
    const details = { bhk: 3, bathrooms: 2, areaSqft: 1420, price: 12500000, furnishing: "semi" };

    it("accepts numbers and typed text, with commas and spaces dropped", () => {
      const parsed = detailsStepSchema.parse({
        ...details,
        bhk: "3",
        areaSqft: "1,420.5",
        price: "1,25,00,000",
        amenities: ["Gym", "Lift"],
      });
      expect(parsed).toMatchObject({ bhk: 3, areaSqft: 1420.5, price: 12500000 });
      expect(parsed.amenities).toEqual(["Gym", "Lift"]);
    });

    it("needs the area and the price, and the amenities default to none", () => {
      const parsed = detailsStepSchema.parse({ areaSqft: 500, price: 0 });
      expect(parsed.amenities).toEqual([]);
      expect(keysOf(detailsStepSchema.safeParse({}), {})).toEqual({
        areaSqft: ["validation.required"],
        price: ["validation.required"],
      });
    });

    it("keeps bathrooms between 0 and 10, whole numbers, and price and area from going negative", () => {
      expect(detailsStepSchema.safeParse({ ...details, bathrooms: 11 }).success).toBe(false);
      expect(detailsStepSchema.safeParse({ ...details, bathrooms: 1.5 }).success).toBe(false);
      expect(detailsStepSchema.safeParse({ ...details, price: -1 }).success).toBe(false);
      expect(detailsStepSchema.safeParse({ ...details, areaSqft: -5 }).success).toBe(false);
      expect(detailsStepSchema.safeParse({ ...details, price: 1.5 }).success).toBe(false);
      expect(detailsStepSchema.safeParse({ ...details, price: 1e12 }).success).toBe(false);
      expect(detailsStepSchema.safeParse({ ...details, areaSqft: "not a number" }).success).toBe(
        false,
      );
    });

    it("accepts only the twelve amenities, none twice", () => {
      expect(detailsStepSchema.safeParse({ ...details, amenities: ["Helipad"] }).success).toBe(
        false,
      );
      expect(detailsStepSchema.safeParse({ ...details, amenities: ["Gym", "Gym"] }).success).toBe(
        false,
      );
      expect(detailsStepSchema.safeParse({ ...details, furnishing: "luxury" }).success).toBe(false);
    });
  });

  describe("step 4, Description", () => {
    it("needs a title of 8 to 140 characters, with its own message when short", () => {
      expect(descriptionStepSchema.safeParse({ title: "3 BHK apartment" }).success).toBe(true);
      expect(keysOf(descriptionStepSchema.safeParse({ title: "Flat" }))).toEqual({
        title: ["validation.titleTooShort"],
      });
      expect(keysOf(descriptionStepSchema.safeParse({ title: "x".repeat(141) }))).toEqual({
        title: ["validation.tooLong"],
      });
    });

    it("keeps the description optional, trims it and limits it to 5000", () => {
      expect(descriptionStepSchema.parse({ title: "3 BHK apartment" }).description).toBeUndefined();
      expect(
        descriptionStepSchema.parse({
          title: "3 BHK apartment",
          description: "  Bright.\nEast facing.  ",
        }).description,
      ).toBe("Bright.\nEast facing.");
      expect(
        descriptionStepSchema.safeParse({ title: "3 BHK apartment", description: "x".repeat(5001) })
          .success,
      ).toBe(false);
    });
  });

  describe("the draft: any field, each one checked when given", () => {
    it("accepts an empty draft and a single field", () => {
      expect(draftFieldsSchema.parse({})).toEqual({});
      expect(draftFieldsSchema.parse({ locality: "Adyar" })).toEqual({ locality: "Adyar" });
    });

    it("clears a field that is sent blank, and leaves a field that is not sent", () => {
      expect(draftFieldsSchema.parse({ title: "", description: "   ", price: "" })).toEqual({
        title: null,
        description: null,
        price: null,
      });
      expect(draftFieldsSchema.parse({ title: null })).toEqual({ title: null });
    });

    it("still checks a field that is filled in", () => {
      expect(draftFieldsSchema.safeParse({ title: "Flat" }).success).toBe(false);
      expect(draftFieldsSchema.safeParse({ pincode: "123" }).success).toBe(false);
      expect(draftFieldsSchema.safeParse({ price: "-4" }).success).toBe(false);
      expect(draftFieldsSchema.safeParse({ amenities: ["Gym", "Gym"] }).success).toBe(false);
    });

    it("ignores fields the wizard does not have, so a client cannot choose the owner, status or location", () => {
      const parsed = draftFieldsSchema.parse({
        title: "3 BHK apartment",
        owner_id: "x",
        ownerId: "x",
        status: "approved",
        featured: true,
        location: "POINT(0 0)",
        state: "Kerala",
      });
      expect(parsed).toEqual({ title: "3 BHK apartment" });
    });
  });

  describe("the actions' inputs", () => {
    it("starting a draft needs a one-time key", () => {
      expect(createDraftSchema.safeParse({ fields: {}, idempotencyKey: KEY }).success).toBe(true);
      expect(createDraftSchema.safeParse({ fields: {} }).success).toBe(false);
      expect(
        createDraftSchema.safeParse({ fields: {}, idempotencyKey: "not-a-uuid" }).success,
      ).toBe(false);
    });

    it("saving needs the listing id, written in lower case", () => {
      expect(
        saveDraftSchema.parse({ listingId: LISTING.toUpperCase(), fields: { locality: "Adyar" } })
          .listingId,
      ).toBe(LISTING);
      expect(saveDraftSchema.safeParse({ listingId: "nope", fields: {} }).success).toBe(false);
    });

    it("submitting needs the listing id and a key", () => {
      expect(
        submitListingSchema.safeParse({ listingId: LISTING, idempotencyKey: KEY }).success,
      ).toBe(true);
      expect(submitListingSchema.safeParse({ listingId: LISTING }).success).toBe(false);
    });
  });
});
