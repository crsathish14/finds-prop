import { describe, expect, it } from "vitest";
import {
  checkDraft,
  draftInput,
  EMPTY_VALUES,
  hasBedrooms,
  stepOfField,
  stepsWithErrors,
  validateContactEmail,
  validateStep,
  valuesFromDraft,
  type WizardValues,
} from "../wizard-state";
import type { DraftView } from "../view";

const complete: WizardValues = {
  ...EMPTY_VALUES,
  address: "12, Second Cross Street, Velachery",
  locality: "Velachery",
  city: "Chennai",
  pincode: "600042",
  bhk: "3",
  bathrooms: "2",
  areaSqft: "1,420",
  price: "1,25,00,000",
  furnishing: "semi",
  amenities: ["Gym", "Lift"],
  title: "3 BHK apartment with clubhouse",
  description: "",
};

const draftView: DraftView = {
  id: "00000000-0000-4000-9000-000000000001",
  shortId: "abcd2345",
  status: "draft",
  rejectionReason: null,
  listingType: "rent",
  propertyType: "villa",
  address: "1 Beach Road",
  locality: "Adyar",
  city: "Chennai",
  pincode: "600020",
  bhk: 4,
  bathrooms: 3,
  areaSqft: 2000,
  price: 90000,
  furnishing: "full",
  amenities: ["Gym"],
  title: "Sea view villa",
  description: null,
  updatedAt: "2026-11-07T10:00:00Z",
  photos: [],
  hasLocation: false,
};

describe("UT-wizard-state: the wizard without React (S6-T02)", () => {
  describe("validateStep", () => {
    it("accepts a complete step 1, 2 and 4, and leaves photos and review to the page", () => {
      expect(validateStep(1, complete)).toEqual({});
      expect(validateStep(2, complete)).toEqual({});
      expect(validateStep(4, complete)).toEqual({});
      expect(validateStep(3, complete)).toEqual({});
      expect(validateStep(5, complete)).toEqual({});
    });

    it("names what step 1 is missing, with the approved messages", () => {
      const errors = validateStep(1, { ...EMPTY_VALUES, pincode: "6000" });
      expect(errors["address"]?.key).toBe("validation.addressRequired");
      expect(errors["pincode"]?.key).toBe("validation.pincodeInvalid");
      expect(errors["locality"]?.key).toBe("validation.required");
      expect(errors["city"]?.key).toBe("validation.required");
    });

    it("needs the area and the price on step 2, and takes bathrooms, bedrooms and furnishing as optional", () => {
      const errors = validateStep(2, { ...EMPTY_VALUES });
      expect(Object.keys(errors).sort()).toEqual(["areaSqft", "price"]);
      expect(validateStep(2, { ...complete, bhk: "", bathrooms: "", furnishing: "" })).toEqual({});
    });

    it("does not ask a plot or commercial space for bedrooms, even if a stale value is still in the box", () => {
      expect(validateStep(2, { ...complete, propertyType: "plot", bhk: "99" })).toEqual({});
      expect(validateStep(2, { ...complete, bhk: "99" })["bhk"]).toBeDefined();
    });

    it("needs a title of 8 or more characters on step 4, and keeps the description optional", () => {
      expect(validateStep(4, { ...complete, title: "Flat" })["title"]?.key).toBe(
        "validation.titleTooShort",
      );
      expect(validateStep(4, { ...complete, description: "" })).toEqual({});
    });
  });

  describe("what is sent", () => {
    it("sends the fields of the steps asked for, and no bedrooms for land", () => {
      expect(Object.keys(draftInput(complete, [1]))).toEqual([
        "listingType",
        "propertyType",
        "address",
        "locality",
        "city",
        "pincode",
      ]);
      expect(draftInput({ ...complete, propertyType: "plot" }, [2])).not.toHaveProperty("bhk");
      expect(draftInput(complete, [2])).toHaveProperty("bhk", "3");
    });

    it("checks a draft field by field, letting empty boxes through", () => {
      expect(checkDraft(draftInput(EMPTY_VALUES, [1, 2, 4]))).toEqual({});
      expect(checkDraft({ title: "Flat" })["title"]).toBeDefined();
      expect(checkDraft({ pincode: "12" })["pincode"]?.key).toBe("validation.pincodeInvalid");
    });
  });

  describe("an opened draft and the steps", () => {
    it("fills the boxes from a saved draft as text, empty where nothing was saved", () => {
      const values = valuesFromDraft(draftView);
      expect(values).toMatchObject({
        listingType: "rent",
        propertyType: "villa",
        bhk: "4",
        areaSqft: "2000",
        price: "90000",
        furnishing: "full",
        amenities: ["Gym"],
        description: "",
      });
      expect(valuesFromDraft({ ...draftView, listingType: null, city: null }).listingType).toBe(
        "sale",
      );
      expect(valuesFromDraft({ ...draftView, city: null }).city).toBe("");
    });

    it("tells which step a field belongs to, photos included, and lists the steps with problems in order", () => {
      expect(stepOfField("address")).toBe(1);
      expect(stepOfField("price")).toBe(2);
      expect(stepOfField("photos")).toBe(3);
      expect(stepOfField("title")).toBe(4);
      expect(stepOfField("listing")).toBeNull();
      expect(
        stepsWithErrors({
          title: { key: "validation.required" },
          address: { key: "validation.required" },
          price: { key: "validation.required" },
        }),
      ).toEqual([1, 2, 4]);
    });

    it("knows which property types have bedrooms", () => {
      expect(hasBedrooms("apartment")).toBe(true);
      expect(hasBedrooms("plot")).toBe(false);
      expect(hasBedrooms("commercial")).toBe(false);
    });
  });

  describe("the email for enquiries (ADR-186)", () => {
    it("starts empty, and an opened draft does not bring one (it belongs to the account)", () => {
      expect(EMPTY_VALUES.contactEmail).toBe("");
      expect(valuesFromDraft(draftView).contactEmail).toBe("");
    });

    it("is asked on the review step", () => {
      expect(stepOfField("contactEmail")).toBe(5);
      expect(stepsWithErrors({ contactEmail: { key: "validation.contactEmailRequired" } })).toEqual(
        [5],
      );
    });

    it("is never part of what a step or Save draft sends, and no step checks it", () => {
      const values = { ...complete, contactEmail: "owner@example.test" };
      expect(Object.keys(draftInput(values, [1, 2, 3, 4, 5]))).not.toContain("contactEmail");
      expect(checkDraft(draftInput(values, [1, 2, 4]))).toEqual({});
      expect(validateStep(5, values)).toEqual({});
    });

    it("is checked on its own before Submit: empty asks for it, a slip is not an address, an address passes", () => {
      expect(validateContactEmail({ ...complete, contactEmail: "" })["contactEmail"]?.key).toBe(
        "validation.contactEmailRequired",
      );
      expect(
        validateContactEmail({ ...complete, contactEmail: "owner" })["contactEmail"]?.key,
      ).toBe("validation.emailInvalid");
      expect(validateContactEmail({ ...complete, contactEmail: " Owner@Example.Test " })).toEqual(
        {},
      );
    });
  });
});
