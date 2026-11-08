import { describe, expect, it } from "vitest";
import {
  toAnswers,
  toFieldLabels,
  toLeadViews,
  toSources,
  toSubmissionViews,
  type LeadDbRow,
  type SubmissionDbRow,
} from "../view";

const ID = "00000000-0000-4000-b000-000000000002";
const FORM = "00000000-0000-4000-b000-000000000003";

const lead = (extra: Partial<LeadDbRow> = {}): LeadDbRow => ({
  id: ID,
  project_id: "00000000-0000-4000-b000-000000000001",
  kind: "enquiry",
  name: "Arjun Menon",
  phone: "9841055512",
  email: null,
  message: "Is a 3 BHK available?",
  visit_date: null,
  status: "new",
  created_at: "2026-10-28T10:42:00+00:00",
  projects: { name: "Kadal Vista" },
  ...extra,
});

describe("UT-lead-view: the leads as the page shows them (S7-T07)", () => {
  it("keeps the columns, with the project's name", () => {
    expect(toLeadViews([lead()])).toEqual({
      leads: [
        {
          id: ID,
          projectId: "00000000-0000-4000-b000-000000000001",
          projectName: "Kadal Vista",
          kind: "enquiry",
          name: "Arjun Menon",
          phone: "9841055512",
          email: null,
          message: "Is a 3 BHK available?",
          visitDate: null,
          status: "new",
          createdAt: "2026-10-28T10:42:00+00:00",
        },
      ],
      skipped: 0,
    });
  });

  it("leaves out, and counts, a lead with a kind or state the page does not know", () => {
    expect(toLeadViews([lead(), lead({ kind: "ghost" }), lead({ status: "won" })]).skipped).toBe(2);
  });

  it("gives an empty project name when the project is not readable", () => {
    expect(toLeadViews([lead({ projects: null })]).leads[0]?.projectName).toBe("");
  });
});

const submission = (extra: Partial<SubmissionDbRow> = {}): SubmissionDbRow => ({
  id: ID,
  form_id: FORM,
  form_name: "Enquiry form",
  name: "Priya Raman",
  mobile: "9840012345",
  email: null,
  data: { name: "Priya Raman", mobile: "9840012345", budget: "1 Cr", wants: ["Parking", "Gym"] },
  source: "project_page",
  crm_status: "failed",
  crm_lead_id: null,
  crm_http_status: 502,
  crm_attempts: 2,
  next_retry_at: "2026-10-28T11:30:00+00:00",
  last_error: "HTTP 502",
  created_at: "2026-10-28T11:02:00+00:00",
  projects: { name: "Kadal Vista" },
  ...extra,
});

describe("UT-submission-view: the form submissions as the page shows them (S7-T07)", () => {
  const labels = toFieldLabels([
    {
      id: FORM,
      fields: [
        { key: "wants", label: "What they want", type: "checkbox" },
        { key: "budget", label: "Budget", type: "text" },
        { key: "name", label: "Name", type: "text" },
      ],
    },
  ]);

  it("labels each answer with the form's question, in the form's order, without the name, mobile and email", () => {
    expect(toAnswers(submission().data, labels.get(FORM))).toEqual([
      { key: "wants", label: "What they want", value: ["Parking", "Gym"] },
      { key: "budget", label: "Budget", value: "1 Cr" },
    ]);
  });

  it("falls back to the key, last, for an answer the form no longer asks", () => {
    expect(toAnswers({ budget: "1 Cr", old: "x" }, labels.get(FORM))).toEqual([
      { key: "budget", label: "Budget", value: "1 Cr" },
      { key: "old", label: "old", value: "x" },
    ]);
    expect(toAnswers({ old: "x" }, undefined)).toEqual([{ key: "old", label: "old", value: "x" }]);
  });

  it("skips values that are not answers and data that is not an object", () => {
    expect(toAnswers({ a1: null, a2: { deep: 1 }, a3: 3, a4: true }, undefined)).toEqual([
      { key: "a3", label: "a3", value: 3 },
      { key: "a4", label: "a4", value: true },
    ]);
    expect(toAnswers(null, undefined)).toEqual([]);
    expect(toAnswers(["x"], undefined)).toEqual([]);
  });

  it("shows how the CRM stands, including the next retry and the error", () => {
    const { submissions } = toSubmissionViews([submission()], labels);
    expect(submissions[0]).toMatchObject({
      formName: "Enquiry form",
      projectName: "Kadal Vista",
      name: "Priya Raman",
      source: "project_page",
      crm: {
        status: "failed",
        httpStatus: 502,
        attempts: 2,
        nextRetryAt: "2026-10-28T11:30:00+00:00",
        lastError: "HTTP 502",
        leadId: null,
      },
    });
  });

  it("leaves out, and counts, a submission with a CRM state the page does not know", () => {
    expect(toSubmissionViews([submission({ crm_status: "lost" })], labels)).toEqual({
      submissions: [],
      skipped: 1,
    });
  });

  it("reads the questions of a form whose fields have more than the page needs, and none from a form it cannot read", () => {
    expect(toFieldLabels([{ id: FORM, fields: "broken" }]).get(FORM)?.size).toBe(0);
    expect(labels.get(FORM)?.get("budget")).toBe("Budget");
  });

  it("lists each source once, alphabetically, and skips a missing one", () => {
    expect(
      toSources([
        { source: "project_page" },
        { source: null },
        { source: "contact_page" },
        { source: "project_page" },
      ]),
    ).toEqual(["contact_page", "project_page"]);
  });
});
