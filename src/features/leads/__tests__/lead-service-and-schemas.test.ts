import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { decodeCursor, encodeCursor } from "../cursor";
import { changeLeadStatus, mapLeadError, type LeadStore } from "../lead-service";
import { rangeStart } from "../queries";
import { leadFilterSchema, setLeadStatusSchema, submissionFilterSchema } from "../schemas";

const PROJECT = "00000000-0000-4000-b000-000000000001";
const LEAD = "00000000-0000-4000-b000-000000000002";

describe("UT-lead-service: changing a lead's state (S7-T07)", () => {
  it("sets the state of the lead the form named and answers where it lives", async () => {
    const store: LeadStore = {
      setStatus: vi.fn(async () => ({
        leadId: LEAD,
        projectId: PROJECT,
        status: "closed" as const,
      })),
    };
    const done = await changeLeadStatus(store, { leadId: LEAD, status: "closed" });
    expect(done).toEqual({ leadId: LEAD, projectId: PROJECT, status: "closed" });
    expect(store.setStatus).toHaveBeenCalledWith(LEAD, "closed");
  });

  it("says not found when there is no such lead, or it is not theirs to change", async () => {
    const store: LeadStore = { setStatus: vi.fn(async () => null) };
    await expect(changeLeadStatus(store, { leadId: LEAD, status: "new" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it.each([
    [{ code: "42501" }, "FORBIDDEN"],
    [{ message: "project_leads.immutable_columns" }, "FORBIDDEN"],
    [{ code: "23514" }, "VALIDATION"],
    [{ code: "22P02" }, "VALIDATION"],
    [{ code: "XX000" }, "INTERNAL"],
    [{}, "INTERNAL"],
  ] as const)("maps %j to %s", (failure, code) => {
    const error = mapLeadError(failure);
    expect(error).toBeInstanceOf(ActionError);
    expect(error).toMatchObject({ code });
  });
});

describe("UT-lead-schemas: what the Leads page sends (S7-T07)", () => {
  it("takes a lead and one of the three states, and refuses anything else", () => {
    expect(setLeadStatusSchema.parse({ leadId: LEAD.toUpperCase(), status: "contacted" })).toEqual({
      leadId: LEAD,
      status: "contacted",
    });
    expect(setLeadStatusSchema.safeParse({ leadId: LEAD, status: "won" }).success).toBe(false);
    expect(setLeadStatusSchema.safeParse({ leadId: "nope", status: "new" }).success).toBe(false);
  });

  it("reads the leads address with all states by default, and drops what is not valid", () => {
    expect(leadFilterSchema.parse({})).toEqual({ status: "all" });
    expect(leadFilterSchema.parse({ project: PROJECT, status: "closed" })).toEqual({
      project: PROJECT,
      status: "closed",
    });
    expect(leadFilterSchema.parse({ project: "nope", status: "won", after: "" })).toEqual({
      status: "all",
    });
  });

  it("reads the submissions address with 30 days and any CRM state by default, and drops what is not valid", () => {
    expect(submissionFilterSchema.parse({})).toEqual({ range: "30", crm: "any" });
    expect(
      submissionFilterSchema.parse({
        range: "7",
        form: PROJECT,
        project: LEAD,
        source: " project_page ",
        crm: "failed",
      }),
    ).toEqual({ range: "7", form: PROJECT, project: LEAD, source: "project_page", crm: "failed" });
    expect(
      submissionFilterSchema.parse({
        range: "forever",
        form: "x",
        source: "y".repeat(300),
        crm: "bad",
      }),
    ).toEqual({ range: "30", crm: "any" });
  });
});

describe("UT-lead-cursor: the page cursor of the two lists (S7-T07)", () => {
  const row = { createdAt: "2026-11-08T07:00:00.123456+00:00", id: LEAD };

  it("reads back the time and id it was made from", () => {
    expect(decodeCursor(encodeCursor(row))).toEqual({ at: row.createdAt, id: LEAD });
  });

  it("ignores a cursor it did not make", () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor("")).toBeNull();
    expect(decodeCursor("not-base64-json")).toBeNull();
    expect(
      decodeCursor(Buffer.from(JSON.stringify(["yesterday", LEAD])).toString("base64url")),
    ).toBeNull();
    expect(
      decodeCursor(Buffer.from(JSON.stringify([row.createdAt, "x"])).toString("base64url")),
    ).toBeNull();
  });
});

describe("UT-lead-range: where a date choice starts (S7-T07)", () => {
  const now = new Date("2026-11-08T10:00:00.000Z");

  it("counts back whole days from now, and has no start for all", () => {
    expect(rangeStart("7", now)).toBe("2026-11-01T10:00:00.000Z");
    expect(rangeStart("30", now)).toBe("2026-10-09T10:00:00.000Z");
    expect(rangeStart("90", now)).toBe("2026-08-10T10:00:00.000Z");
    expect(rangeStart("all", now)).toBeNull();
  });
});
