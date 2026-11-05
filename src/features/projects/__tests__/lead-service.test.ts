import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  mapProjectWriteError,
  recordProjectEvent,
  submitLead,
  type EventRow,
  type LeadRow,
  type ProjectWriteStore,
} from "../lead-service";
import type { SubmitProjectLeadInput } from "../lead-schemas";

const VISITOR = "a".repeat(40);

function fakeStore(options: { recorded?: boolean } = {}) {
  const leads: LeadRow[] = [];
  const events: EventRow[] = [];
  const store: ProjectWriteStore = {
    insertLead: (row) => {
      leads.push(row);
      return Promise.resolve("lead-1");
    },
    recordEvent: (row) => {
      events.push(row);
      return Promise.resolve(options.recorded ?? true);
    },
  };
  return { store, leads, events };
}

const input = (overrides: Partial<SubmitProjectLeadInput> = {}): SubmitProjectLeadInput => ({
  slug: "kadal-vista",
  kind: "enquiry",
  name: "Priya Raman",
  email: undefined,
  message: undefined,
  visitDate: undefined,
  idempotencyKey: "8f14e45f-ceea-4672-9a4c-2d6c3a1b7e90",
  ...overrides,
});

describe("UT-project-lead-service: storing a lead (S4-T09 step D)", () => {
  it("stores the form's values with the account's phone and the visitor hash, and returns the id", async () => {
    const { store, leads } = fakeStore();
    const result = await submitLead(store, {
      input: input({ email: "priya@example.com", message: "Is a 3 BHK left?" }),
      phone: "919840012345",
      visitor: VISITOR,
    });
    expect(result).toEqual({ leadId: "lead-1" });
    expect(leads).toEqual([
      {
        slug: "kadal-vista",
        kind: "enquiry",
        name: "Priya Raman",
        phone: "919840012345",
        email: "priya@example.com",
        message: "Is a 3 BHK left?",
        visitDate: null,
        visitor: VISITOR,
      },
    ]);
  });

  it("keeps the date of a site visit and drops a date that came with an enquiry", async () => {
    const { store, leads } = fakeStore();
    await submitLead(store, {
      input: input({ kind: "site_visit", visitDate: "2026-11-20" }),
      phone: "919840012345",
      visitor: VISITOR,
    });
    await submitLead(store, {
      input: input({ kind: "enquiry", visitDate: "2026-11-20" }),
      phone: "919840012345",
      visitor: VISITOR,
    });
    expect(leads.map((lead) => lead.visitDate)).toEqual(["2026-11-20", null]);
  });

  it("lets an error from the store through, so nothing is reported as sent", async () => {
    const store: ProjectWriteStore = {
      insertLead: () => Promise.reject(new ActionError("NOT_FOUND", "gone")),
      recordEvent: () => Promise.resolve(false),
    };
    await expect(
      submitLead(store, { input: input(), phone: "919840012345", visitor: VISITOR }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("UT-project-event-service: recording an event", () => {
  it("passes the project, the kind and the visitor on, and says whether it was recorded", async () => {
    const { store, events } = fakeStore();
    await expect(
      recordProjectEvent(store, { slug: "kadal-vista", event: "view", visitor: VISITOR }),
    ).resolves.toEqual({ recorded: true });
    expect(events).toEqual([{ slug: "kadal-vista", event: "view", visitor: VISITOR }]);
  });

  it("says nothing was recorded for a repeat view or a project nobody can see, without an error", async () => {
    const { store } = fakeStore({ recorded: false });
    await expect(
      recordProjectEvent(store, { slug: "kadal-vista", event: "view", visitor: VISITOR }),
    ).resolves.toEqual({ recorded: false });
  });
});

describe("UT-project-write-error: what the database says becomes a closed error", () => {
  it("makes a project nobody can see not found", () => {
    expect(
      mapProjectWriteError({ code: "P0002", message: "project_lead.project_not_found" }),
    ).toMatchObject({ code: "NOT_FOUND" });
  });

  it("makes a refused visit date the field's own range problem", () => {
    expect(
      mapProjectWriteError({ code: "22023", message: "project_lead.visit_date" }),
    ).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { visitDate: [{ key: "validation.visitDateRange" }] },
    });
  });

  it("makes a refused kind a problem with the kind", () => {
    expect(mapProjectWriteError({ code: "22023", message: "project_lead.kind" })).toMatchObject({
      code: "VALIDATION",
      fieldErrors: { kind: [{ key: "validation.invalid" }] },
    });
  });

  it("makes a refused value a form-level validation problem", () => {
    expect(mapProjectWriteError({ code: "23514" })).toMatchObject({ code: "VALIDATION" });
  });

  it("makes anything else, such as a visitor hash the function refuses or a lost connection, internal", () => {
    for (const failure of [
      { code: "22023", message: "project_lead.visitor" },
      { code: "22023", message: "project_event.visitor" },
      { code: "08006" },
      {},
    ]) {
      expect(mapProjectWriteError(failure)).toMatchObject({ code: "INTERNAL" });
    }
  });
});
