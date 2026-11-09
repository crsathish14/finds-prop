import { describe, expect, it } from "vitest";
import {
  BADGE_STATUS,
  EMPTY_UNIT_VALUES,
  facingValueOf,
  isUnitFormField,
  valuesOfUnit,
} from "../form";
import { unitsHref } from "../href";
import type { UnitView } from "../view";

const PROJECT = "00000000-0000-4000-b000-000000000001";

const unit: UnitView = {
  id: "00000000-0000-4000-a000-000000000001",
  unitNumber: "A-101",
  floor: 1,
  bhk: 2,
  areaSqft: 1050.5,
  facing: "North-east",
  price: 7800000,
  availableFrom: "2026-12-01",
  floorPlanUrl: "https://kadalhomes.example/plans/a-101.pdf",
  status: "hold",
};

describe("UT-unit-form: the Add and Edit boxes (S7-T07)", () => {
  it("opens the add form empty, with the unit available", () => {
    expect(EMPTY_UNIT_VALUES).toEqual({
      unitNumber: "",
      floor: "",
      bhk: "",
      area: "",
      facing: "",
      price: "",
      status: "available",
      availableFrom: "",
      floorPlanUrl: "",
    });
  });

  it("opens the edit form with what is on record, the direction as the list holds it", () => {
    expect(valuesOfUnit(unit)).toEqual({
      unitNumber: "A-101",
      floor: "1",
      bhk: "2",
      area: "1050.5",
      facing: "north-east",
      price: "7800000",
      status: "hold",
      availableFrom: "2026-12-01",
      floorPlanUrl: "https://kadalhomes.example/plans/a-101.pdf",
    });
  });

  it("opens a blank box for anything not given, and for a direction it does not know", () => {
    expect(
      valuesOfUnit({
        ...unit,
        floor: null,
        bhk: null,
        areaSqft: null,
        facing: "Up",
        price: null,
        availableFrom: null,
        floorPlanUrl: null,
      }),
    ).toMatchObject({
      floor: "",
      bhk: "",
      area: "",
      facing: "",
      price: "",
      availableFrom: "",
      floorPlanUrl: "",
    });
    expect(facingValueOf(null)).toBe("");
    expect(facingValueOf("West")).toBe("west");
  });

  it("knows which answers belong to a box, and which state the badge calls what", () => {
    expect(isUnitFormField("price")).toBe(true);
    expect(isUnitFormField("unitId")).toBe(false);
    expect(BADGE_STATUS.hold).toBe("onHold");
  });
});

describe("UT-units-href: the address of the Units page (S7-T07)", () => {
  it("always names the project and leaves out the default state and an empty search", () => {
    expect(unitsHref({ projectId: PROJECT, state: "all" })).toBe(`/admin/units?project=${PROJECT}`);
    expect(unitsHref({ projectId: PROJECT, state: "all", search: "" })).toBe(
      `/admin/units?project=${PROJECT}`,
    );
  });

  it("adds the state and the search when they are chosen, and makes the search safe", () => {
    expect(unitsHref({ projectId: PROJECT, state: "sold", search: "A 1&2" })).toBe(
      `/admin/units?project=${PROJECT}&state=sold&search=A+1%262`,
    );
  });

  it("stays under the path it is given, so the builder's links do not leave the builder portal (S7-T03)", () => {
    expect(unitsHref({ projectId: PROJECT, state: "sold" }, "/builder/units")).toBe(
      `/builder/units?project=${PROJECT}&state=sold`,
    );
  });
});
