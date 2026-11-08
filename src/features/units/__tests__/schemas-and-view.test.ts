import { describe, expect, it } from "vitest";
import { UNIT_SEARCH_MAX, UNIT_NUMBER_MAX } from "../constants";
import { escapeLikeForTest } from "./escape";
import { addUnitSchema, unitFilterSchema, updateUnitSchema } from "../schemas";
import { toUnitViews, type UnitDbRow } from "../view";

const PROJECT = "00000000-0000-4000-b000-000000000001";
const UNIT = "00000000-0000-4000-b000-000000000002";

const base = { projectId: PROJECT, unitNumber: "B-303", status: "available" };

const messages = (input: unknown) => {
  const result = addUnitSchema.safeParse(input);
  if (result.success) return [];
  return result.error.issues.map((issue) => `${issue.path.join(".")}:${issue.message}`);
};

describe("UT-unit-schemas: what the unit form may send (S7-T07)", () => {
  it("takes a number and a state, and trims and tidies the number", () => {
    expect(addUnitSchema.parse({ ...base, unitNumber: "  B-303  " }).unitNumber).toBe("B-303");
    expect(addUnitSchema.parse({ ...base, unitNumber: "B   303" }).unitNumber).toBe("B 303");
  });

  it("refuses a blank or too long number, and a state or project that is not one", () => {
    expect(messages({ ...base, unitNumber: "   " })).toEqual(["unitNumber:validation.required"]);
    expect(messages({ ...base, unitNumber: "x".repeat(UNIT_NUMBER_MAX + 1) })).toEqual([
      "unitNumber:validation.invalid",
    ]);
    expect(messages({ ...base, status: "gone" })).toEqual(["status:validation.invalid"]);
    expect(messages({ ...base, projectId: "nope" })).toEqual(["projectId:validation.invalid"]);
  });

  it("reads numbers typed with commas and spaces, as whole numbers or with two decimals", () => {
    const parsed = addUnitSchema.parse({
      ...base,
      floor: " -1 ",
      bhk: "0",
      area: "1,480.25",
      price: "1 180 00 00",
    });
    expect(parsed).toMatchObject({ floor: -1, bhk: 0, area: 1480.25, price: 11800000 });
  });

  it.each([
    ["floor", "ground", "validation.numberInvalid"],
    ["floor", "3.5", "validation.numberInvalid"],
    ["floor", "201", "validation.invalid"],
    ["bhk", "11", "validation.invalid"],
    ["area", "10.555", "validation.invalid"],
    ["area", "-1", "validation.invalid"],
    ["price", "ten", "validation.numberInvalid"],
    ["price", "99999999999999999", "validation.invalid"],
    ["facing", "up", "validation.invalid"],
    ["availableFrom", "2026-02-30", "validation.invalid"],
    ["availableFrom", "1 Dec 2026", "validation.invalid"],
    ["floorPlanUrl", "kadalhomes", "validation.linkInvalid"],
    ["floorPlanUrl", "http://kadalhomes.example/plan.pdf", "validation.linkInvalid"],
  ])("refuses %s of %j", (field, value, message) => {
    expect(messages({ ...base, [field]: value })).toEqual([`${field}:${message}`]);
  });

  it("treats a blank optional box as no value, and an absent one as not sent", () => {
    const parsed = updateUnitSchema.parse({
      unitId: UNIT,
      unitNumber: "B-1",
      status: "sold",
      floor: "",
    });
    expect(parsed.floor).toBeNull();
    expect(parsed.bhk).toBeUndefined();
  });

  it("knows the eight directions", () => {
    for (const facing of [
      "east",
      "north-east",
      "north",
      "north-west",
      "west",
      "south-west",
      "south",
      "south-east",
    ]) {
      expect(addUnitSchema.safeParse({ ...base, facing }).success).toBe(true);
    }
  });
});

describe("UT-unit-schemas: the list's address (S7-T07)", () => {
  it("needs a project, and takes the state, the search and the cursor when they are valid", () => {
    expect(unitFilterSchema.parse({ projectId: PROJECT })).toEqual({
      projectId: PROJECT,
      state: "all",
    });
    expect(
      unitFilterSchema.parse({
        projectId: PROJECT,
        state: "sold",
        search: " A-1 ",
        after: "A-100",
      }),
    ).toEqual({ projectId: PROJECT, state: "sold", search: "A-1", after: "A-100" });
    expect(unitFilterSchema.safeParse({}).success).toBe(false);
  });

  it("drops a state, a search or a cursor that is not valid instead of failing", () => {
    expect(
      unitFilterSchema.parse({
        projectId: PROJECT,
        state: "gone",
        search: "x".repeat(UNIT_SEARCH_MAX + 1),
        after: "",
      }),
    ).toEqual({ projectId: PROJECT, state: "all" });
  });
});

describe("UT-unit-view: the rows as the page shows them (S7-T07)", () => {
  const row = (extra: Partial<UnitDbRow> = {}): UnitDbRow => ({
    id: UNIT,
    unit_number: "A-101",
    floor_number: 1,
    bhk: 2,
    area_sqft: "1050.00",
    facing: "East",
    price: 7800000,
    available_from: "2026-12-01",
    floor_plan_path: null,
    status: "available",
    ...extra,
  });

  it("turns the text numbers into numbers and keeps the rest", () => {
    expect(toUnitViews([row()])).toEqual({
      units: [
        {
          id: UNIT,
          unitNumber: "A-101",
          floor: 1,
          bhk: 2,
          areaSqft: 1050,
          facing: "East",
          price: 7800000,
          availableFrom: "2026-12-01",
          floorPlanUrl: null,
          status: "available",
        },
      ],
      skipped: 0,
    });
  });

  it("keeps a missing value as null, and a number that is not a number as null", () => {
    const { units } = toUnitViews([row({ area_sqft: null, price: "abc", floor_number: null })]);
    expect(units[0]).toMatchObject({ areaSqft: null, price: null, floor: null });
  });

  it("leaves out, and counts, a row with a state the page does not know", () => {
    expect(toUnitViews([row(), row({ status: "demolished" })])).toMatchObject({ skipped: 1 });
  });
});

describe("the search text", () => {
  it("makes % and _ and \\ letters to look for, not wildcards", () => {
    expect(escapeLikeForTest("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});
