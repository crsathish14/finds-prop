import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, visitorClient } from "./support/clients";
import {
  createBuilderRecord,
  grantRole,
  removeTestAdmin,
  removeTestUser,
  signInTestAdmin,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// Outside a request there is no cookie or header store; the store below takes its client directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { unitStore } = await import("@/features/units/service");
const { addUnitTo, removeUnit, saveUnit } = await import("@/features/units/unit-service");
const { addUnitSchema, unitFilterSchema, updateUnitSchema } =
  await import("@/features/units/schemas");
const { readProjectOptions, readUnitsPage } = await import("@/features/units/queries");
const { ActionError } = await import("@/server/actions/normalise-error");

const SLUG = `it-units-${randomUUID().slice(0, 8)}`;

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("IT-units: the admin's unit changes against a real database (S7-T07, FR-ADM-05)", () => {
  const admin = adminClient();
  let staff: TestUser;
  let builder: TestUser;
  let projectId: string;

  const row = async (unitId: string) => {
    const { data, error } = await admin
      .from("project_units")
      .select("*")
      .eq("id", unitId)
      .maybeSingle();
    if (error) throw new Error(`Could not read the unit (${error.code})`);
    return data;
  };

  const add = (extra: Record<string, unknown> = {}) =>
    addUnitTo(
      unitStore(staff.client),
      addUnitSchema.parse({
        projectId,
        unitNumber: `U-${randomUUID().slice(0, 6)}`,
        status: "available",
        ...extra,
      }),
    );

  beforeAll(async () => {
    staff = await signInTestAdmin();
    builder = await signInTestCustomer();
    await grantRole(builder.userId, "builder");
    const builderId = await createBuilderRecord(builder.userId, { active: true });
    const { data, error } = await admin
      .from("projects")
      .insert({
        slug: SLUG,
        name: "Units Integration Project",
        builder_id: builderId,
        locality: "Integration Test Locality",
        moderation: "approved",
        published: true,
        moderated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create the test project (${error.code})`);
    projectId = data.id;
  });

  afterAll(async () => {
    await admin.from("project_units").delete().eq("project_id", projectId);
    await admin.from("projects").delete().eq("id", projectId);
    await removeTestUser();
    await removeTestAdmin();
  });

  it("adds a unit with the columns the form gave, and answers the project's address for the cache tags", async () => {
    const done = await add({
      unitNumber: "A-101",
      floor: "1",
      bhk: "2",
      area: "1,050.5",
      facing: "north-east",
      price: "7800000",
      availableFrom: "2026-12-01",
      floorPlanUrl: "https://kadalhomes.example/plans/a-101.pdf",
    });
    expect(done).toMatchObject({ projectId, projectSlug: SLUG });
    expect(await row(done.unitId)).toMatchObject({
      project_id: projectId,
      unit_number: "A-101",
      floor_number: 1,
      bhk: 2,
      facing: "North-east",
      price: 7800000,
      available_from: "2026-12-01",
      floor_plan_path: "https://kadalhomes.example/plans/a-101.pdf",
      status: "available",
    });
    expect(Number((await row(done.unitId))?.area_sqft)).toBe(1050.5);
  });

  it("refuses a unit number that the project already has, on the number's own box", async () => {
    await add({ unitNumber: "DUP-1" });
    const error = await failureOf(() => add({ unitNumber: "DUP-1" }));
    expect(error).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { unitNumber: [{ key: "validation.unitNumberTaken" }] },
    });
  });

  it("saves a unit, clears a box that was blanked and leaves the project as it was", async () => {
    const made = await add({ unitNumber: "SAVE-1", price: "5000000", floor: "4" });
    const done = await saveUnit(
      unitStore(staff.client),
      updateUnitSchema.parse({
        unitId: made.unitId,
        unitNumber: "SAVE-1",
        status: "sold",
        price: "",
      }),
    );
    expect(done.projectId).toBe(projectId);
    expect(await row(made.unitId)).toMatchObject({
      status: "sold",
      price: null,
      floor_number: 4,
      project_id: projectId,
    });
  });

  it("says not found for a unit that is not there, on a save and on a delete", async () => {
    const missing = randomUUID();
    const save = updateUnitSchema.parse({ unitId: missing, unitNumber: "X-1", status: "hold" });
    expect(await failureOf(() => saveUnit(unitStore(staff.client), save))).toMatchObject({
      code: "NOT_FOUND",
    });
    expect(await failureOf(() => removeUnit(unitStore(staff.client), missing))).toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("deletes a unit, and a second delete finds nothing", async () => {
    const made = await add({ unitNumber: "GONE-1" });
    expect(await removeUnit(unitStore(staff.client), made.unitId)).toMatchObject({
      unitId: made.unitId,
      projectSlug: SLUG,
    });
    expect(await row(made.unitId)).toBeNull();
    expect(await failureOf(() => removeUnit(unitStore(staff.client), made.unitId))).toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("reads a project's units by unit number, 25 to a page, with the count and the cursor for the rest", async () => {
    const rows = Array.from({ length: 27 }, (_unused, index) => ({
      project_id: projectId,
      unit_number: `PG-${String(index + 1).padStart(2, "0")}`,
      status: index < 3 ? ("hold" as const) : ("available" as const),
    }));
    const inserted = await admin.from("project_units").insert(rows);
    if (inserted.error) throw new Error(`Could not add the units (${inserted.error.code})`);
    const filters = (extra: Record<string, unknown> = {}) =>
      unitFilterSchema.parse({ projectId, search: "PG-", ...extra });

    const first = await readUnitsPage(staff.client, filters());
    expect(first.units).toHaveLength(25);
    expect(first.total).toBe(27);
    expect(first.units[0]?.unitNumber).toBe("PG-01");
    expect(first.nextCursor).toBe("PG-25");

    const second = await readUnitsPage(staff.client, filters({ after: first.nextCursor }));
    expect(second.units.map((unit) => unit.unitNumber)).toEqual(["PG-26", "PG-27"]);
    expect(second.nextCursor).toBeNull();
    expect(second.total).toBe(27);

    const held = await readUnitsPage(staff.client, filters({ state: "hold" }));
    expect(held.total).toBe(3);
    expect(held.units.every((unit) => unit.status === "hold")).toBe(true);
  });

  it("looks for a unit number as letters, so a % or _ in the search is not a wildcard", async () => {
    const wild = await readUnitsPage(
      staff.client,
      unitFilterSchema.parse({ projectId, search: "%" }),
    );
    expect(wild.total).toBe(0);
    const some = await readUnitsPage(
      staff.client,
      unitFilterSchema.parse({ projectId, search: "pg-0" }),
    );
    expect(some.total).toBe(9);
  });

  it("lists every project for the picker, by name", async () => {
    const options = await readProjectOptions(staff.client);
    expect(options).toContainEqual({ id: projectId, name: "Units Integration Project" });
  });

  it("refuses a visitor who is not signed in (the database, not the action, says no)", async () => {
    const error = await failureOf(() =>
      addUnitTo(
        unitStore(visitorClient()),
        addUnitSchema.parse({ projectId, unitNumber: "NOPE-1", status: "available" }),
      ),
    );
    expect(error).toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets the builder of the project add a unit to it, which is why the same store serves the builder portal later", async () => {
    const done = await addUnitTo(
      unitStore(builder.client),
      addUnitSchema.parse({ projectId, unitNumber: "OWN-1", status: "hold" }),
    );
    expect(await row(done.unitId)).toMatchObject({ unit_number: "OWN-1", status: "hold" });
  });
});
