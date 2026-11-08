import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { addUnitSchema, updateUnitSchema } from "../schemas";
import {
  addUnitTo,
  mapUnitError,
  removeUnit,
  saveUnit,
  unitRowFrom,
  type UnitDone,
  type UnitStore,
} from "../unit-service";

const PROJECT = "00000000-0000-4000-b000-000000000001";
const UNIT = "00000000-0000-4000-b000-000000000002";
const done: UnitDone = { unitId: UNIT, projectId: PROJECT, projectSlug: "kadal-vista" };

function store(overrides: Partial<UnitStore> = {}): UnitStore {
  return {
    insert: vi.fn(async () => done),
    update: vi.fn(async () => done),
    remove: vi.fn(async () => done),
    ...overrides,
  };
}

const typed = (extra: Record<string, unknown> = {}) =>
  addUnitSchema.parse({ projectId: PROJECT, unitNumber: "B-303", status: "available", ...extra });

describe("UT-unit-service: the columns a unit form gives (S7-T07)", () => {
  it("writes only the number and the state when nothing else was given", () => {
    expect(unitRowFrom(typed())).toEqual({ unit_number: "B-303", status: "available" });
  });

  it("maps every box to its column, the direction to its word and the link to the plan column", () => {
    const row = unitRowFrom(
      typed({
        floor: "3",
        bhk: "3",
        area: "1,480.5",
        facing: "north-east",
        price: "11,800,000",
        availableFrom: "2026-12-01",
        floorPlanUrl: "https://kadalhomes.example/plans/b-303.pdf",
      }),
    );
    expect(row).toEqual({
      unit_number: "B-303",
      status: "available",
      floor_number: 3,
      bhk: 3,
      area_sqft: 1480.5,
      facing: "North-east",
      price: 11800000,
      available_from: "2026-12-01",
      floor_plan_path: "https://kadalhomes.example/plans/b-303.pdf",
    });
  });

  it("clears a column when its box was blanked on a save, and leaves it when it was not sent", () => {
    const input = updateUnitSchema.parse({
      unitId: UNIT,
      unitNumber: "B-303",
      status: "sold",
      floor: "",
      facing: "",
      price: "",
    });
    expect(unitRowFrom(input)).toEqual({
      unit_number: "B-303",
      status: "sold",
      floor_number: null,
      facing: null,
      price: null,
    });
  });
});

describe("UT-unit-service: adding, saving and deleting (S7-T07)", () => {
  it("adds to the project the form named, with the columns, and answers where the unit lives", async () => {
    const made = store();
    expect(await addUnitTo(made, typed({ floor: "2" }))).toEqual(done);
    expect(made.insert).toHaveBeenCalledWith(PROJECT, {
      unit_number: "B-303",
      status: "available",
      floor_number: 2,
    });
  });

  it("saves the unit the form named", async () => {
    const made = store();
    const input = updateUnitSchema.parse({ unitId: UNIT, unitNumber: "B-303", status: "hold" });
    expect(await saveUnit(made, input)).toEqual(done);
    expect(made.update).toHaveBeenCalledWith(UNIT, { unit_number: "B-303", status: "hold" });
  });

  it("says not found when a save or a delete finds no such unit", async () => {
    const empty = store({ update: vi.fn(async () => null), remove: vi.fn(async () => null) });
    const input = updateUnitSchema.parse({ unitId: UNIT, unitNumber: "B-303", status: "hold" });
    await expect(saveUnit(empty, input)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(removeUnit(empty, UNIT)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("deletes the unit and answers its project", async () => {
    const made = store();
    expect(await removeUnit(made, UNIT)).toEqual(done);
    expect(made.remove).toHaveBeenCalledWith(UNIT);
  });
});

describe("UT-unit-service: what the database says when it refuses", () => {
  it("puts a repeated unit number on the number's own box", () => {
    const error = mapUnitError({ code: "23505" });
    expect(error).toBeInstanceOf(ActionError);
    expect(error).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { unitNumber: [{ key: "validation.unitNumberTaken" }] },
    });
  });

  it.each([
    [{ code: "23503" }, "NOT_FOUND"],
    [{ code: "42501" }, "FORBIDDEN"],
    [{ message: "project_units.project_immutable" }, "VALIDATION"],
    [{ code: "23514" }, "VALIDATION"],
    [{ code: "22003" }, "VALIDATION"],
    [{ code: "XX000" }, "INTERNAL"],
    [{}, "INTERNAL"],
  ] as const)("maps %j to %s", (failure, code) => {
    expect(mapUnitError(failure)).toMatchObject({ code });
  });
});
