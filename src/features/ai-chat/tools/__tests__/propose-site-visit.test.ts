import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROPOSAL_MESSAGE_MAX_CHARACTERS } from "@/config/ai";
import { AS_OF_TEXT, injected, projectData, READ_AT, stringsIn, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-propose-visit (ADR-128 section 5.3): `propose_site_visit` checks and prepares, and writes nothing.
// The read, the session and the signing secret are stand-ins; the project, the customer and the words are made up.

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const MESSAGE = "I would like to see the show flat on Saturday morning.";
/** 15 Nov 2026, 12:00 in India. The window is 15 Nov 2026 to 15 Nov 2027. */
const NOW = new Date("2026-11-15T06:30:00.000Z");

const settings = vi.hoisted(() => ({
  env: { RATE_LIMIT_HMAC_SECRET: "a-made-up-secret-of-thirty-two-chars!" as string | undefined },
}));
const getProject = vi.fn();
const getSessionView = vi.fn();
const createAdminSupabase = vi.fn();
const error = vi.fn();

vi.mock("@/server/env", () => ({ env: settings.env }));
vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
vi.mock("@/features/projects", async () => {
  const { isProjectSlug } = await import("@/features/projects/address");
  const { visitDateProblem } = await import("@/features/projects/lead-view");
  return { getProject, isProjectSlug, visitDateProblem };
});
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView }));
// A write would go through the service role. The tool must never reach for it.
vi.mock("@/server/supabase/admin.server", () => ({ createAdminSupabase }));

const { toPortableJsonSchema } = await import("@/server/ai");
const { runTool } = await import("../run");
const { verifyProposal } = await import("../proposal");
const { proposeSiteVisitInputSchema, proposeSiteVisitTool } = await import("../propose-site-visit");

const propose = (input: unknown) =>
  runTool([proposeSiteVisitTool], { name: "propose_site_visit", input }, TOOL_CONTEXT);

const visit = (visitDate: string, extra: Record<string, unknown> = {}) =>
  propose({ slug: "kadal-vista", visitDate, message: MESSAGE, ...extra });

const found = (overrides: Parameters<typeof projectData>[0] = {}) => ({
  status: "found",
  project: projectData(overrides),
  readAt: READ_AT,
});

const okOutput = (outcome: Awaited<ReturnType<typeof propose>>) => {
  if (outcome.status !== "ok") throw new Error(`not ok: ${outcome.content}`);
  return outcome.output as Record<string, unknown>;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  settings.env.RATE_LIMIT_HMAC_SECRET = "a-made-up-secret-of-thirty-two-chars!";
  getProject.mockResolvedValue(found());
  getSessionView.mockResolvedValue({
    userId: CUSTOMER,
    roles: ["customer"],
    phoneVerified: true,
    builderId: null,
  });
});
afterEach(() => vi.useRealTimers());

describe("UT-ai-tool-propose-visit: the input", () => {
  it("is called propose_site_visit, is a propose tool, and takes a project, a day and a message and nothing else", () => {
    expect(proposeSiteVisitTool.name).toBe("propose_site_visit");
    expect(proposeSiteVisitTool.kind).toBe("propose");
    expect(toPortableJsonSchema(proposeSiteVisitInputSchema)).toMatchObject({
      type: "object",
      properties: {
        slug: { type: "string" },
        visitDate: { type: "string" },
        message: { type: "string" },
      },
      required: ["slug", "visitDate", "message"],
      additionalProperties: false,
    });
  });

  it("ignores a person the model tries to add: the customer is only ever the session", async () => {
    const outcome = await visit("2026-12-05", {
      userId: "99999999-9999-4999-8999-999999999999",
      phone: "made-up-phone",
    });
    const proposal = okOutput(outcome).proposal as string;
    expect(verifyProposal(proposal, CUSTOMER).status).toBe("valid");
    expect(outcome.content).not.toContain("99999999-9999-4999-8999-999999999999");
  });

  it.each([
    ["nothing", ""],
    ["a name with capitals and spaces inside", "Kadal Vista"],
    ["a path", "/projects/kadal-vista"],
    ["a number", 5],
    ["no slug", null],
  ])("refuses %s as a slug and reads nothing", async (_case, slug) => {
    expect(await propose({ slug, visitDate: "2026-12-05", message: MESSAGE })).toMatchObject({
      status: "error",
      code: "invalid_input",
      fields: ["slug"],
    });
    expect(getProject).not.toHaveBeenCalled();
    expect(getSessionView).not.toHaveBeenCalled();
  });

  it.each([
    ["no day", ""],
    ["words", "tomorrow"],
    ["a day written the other way", "05/12/2026"],
    ["a day with a time", "2026-12-05T10:00"],
    ["a number", 20261205],
    ["no day at all", null],
  ])("refuses %s as a day, asks for the day again, and reads nothing", async (_case, visitDate) => {
    expect(await visit(visitDate as string)).toMatchObject({
      status: "error",
      code: "invalid_input",
      fields: ["visitDate"],
    });
    expect(getProject).not.toHaveBeenCalled();
    expect(getSessionView).not.toHaveBeenCalled();
  });

  it.each([
    ["no message", ""],
    ["only spaces", "  \n "],
    ["a message too long", "x".repeat(PROPOSAL_MESSAGE_MAX_CHARACTERS + 1)],
    ["only characters that show nothing", "​⁠"],
  ])("refuses %s and reads nothing", async (_case, message) => {
    expect(await propose({ slug: "kadal-vista", visitDate: "2026-12-05", message })).toMatchObject({
      status: "error",
      code: "invalid_input",
      fields: ["message"],
    });
    expect(getProject).not.toHaveBeenCalled();
  });

  it("reads capitals and stray spaces in the slug as the project page does", async () => {
    await propose({ slug: " Kadal-Vista ", visitDate: "2026-12-05", message: MESSAGE });
    expect(getProject).toHaveBeenCalledExactlyOnceWith("kadal-vista");
  });
});

describe("UT-ai-tool-propose-visit: the day must be from today to a year ahead, India time", () => {
  it.each([
    ["today", "2026-11-15"],
    ["tomorrow", "2026-11-16"],
    ["the last day, a year ahead", "2027-11-15"],
  ])("accepts %s", async (_case, day) => {
    expect(okOutput(await visit(day))).toMatchObject({ status: "ready", visitDate: day });
  });

  it.each([
    ["yesterday", "2026-11-14"],
    ["a year and a day ahead", "2027-11-16"],
    ["long ago", "2020-01-01"],
    ["far ahead", "2099-12-31"],
    ["a day that does not exist", "2026-02-30"],
    ["a month that does not exist", "2026-13-01"],
  ])("refuses %s as date_out_of_range, and reads nothing", async (_case, day) => {
    const outcome = await visit(day);
    expect(outcome).toEqual({
      status: "error",
      code: "date_out_of_range",
      fields: [],
      content: expect.stringContaining('"error":"date_out_of_range"'),
    });
    expect(JSON.parse(outcome.content).hint).toContain("one year ahead");
    expect(getProject).not.toHaveBeenCalled();
    expect(getSessionView).not.toHaveBeenCalled();
  });

  it("counts today in India, not in UTC: at 00:30 on 15 Nov in India it is still 14 Nov in UTC", async () => {
    vi.setSystemTime(new Date("2026-11-14T19:00:00.000Z"));
    expect(okOutput(await visit("2026-11-15"))).toMatchObject({ status: "ready" });
    expect(await visit("2026-11-14")).toMatchObject({ status: "error", code: "date_out_of_range" });
  });

  it("holds the same limits as the form and the database use: the same rule, not a copy", async () => {
    const { visitDateProblem } = await import("@/features/projects/lead-view");
    for (const day of ["2026-11-14", "2026-11-15", "2027-11-15", "2027-11-16", "2026-02-30"]) {
      const accepted = (await visit(day)).status === "ok";
      expect(accepted, day).toBe(visitDateProblem(day, NOW) === null);
    }
  });
});

describe("UT-ai-tool-propose-visit: a project that is open, for a signed-in customer", () => {
  it("returns what the card needs with a proposal signed for this customer, and writes nothing", async () => {
    const outcome = await visit("2026-12-05");
    expect(outcome).toEqual({
      status: "ok",
      output: {
        status: "ready",
        asOf: AS_OF_TEXT,
        expiresAt: "2026-11-15T07:00:00.000Z",
        proposal: expect.any(String),
        target: { slug: "kadal-vista" },
        visitDate: "2026-12-05",
        untrustedText: { name: "Kadal Vista", message: MESSAGE },
      },
      references: [{ kind: "project", slug: "kadal-vista" }],
      content: expect.any(String),
    });
    expect(JSON.parse(outcome.content)).toEqual(outcome.status === "ok" ? outcome.output : null);
    expect(createAdminSupabase).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("signs the project, the day, the message and the customer, and the proposal reads back the same", async () => {
    const output = okOutput(await visit("2026-12-05", { message: `  ${MESSAGE}​ ` }));
    expect(verifyProposal(output.proposal, CUSTOMER, NOW)).toMatchObject({
      status: "valid",
      proposal: {
        kind: "site_visit",
        slug: "kadal-vista",
        visitDate: "2026-12-05",
        message: MESSAGE,
        userId: CUSTOMER,
      },
    });
    expect(verifyProposal(output.proposal, "22222222-2222-4222-8222-222222222222", NOW)).toEqual({
      status: "refused",
      reason: "other_customer",
    });
  });

  it("keeps everything a third party typed under untrustedText, and nowhere else", async () => {
    getProject.mockResolvedValue(found({ name: injected("project") }));
    const outcome = await visit("2026-12-05");
    const typed = stringsIn(outcome.status === "ok" ? outcome.output : null).filter(({ text }) =>
      text.includes("Zzinject"),
    );
    expect(typed.map(({ path }) => path.join("."))).toEqual(["untrustedText.name"]);
  });

  it("gives the model no developer contact and no customer id", async () => {
    const outcome = await visit("2026-12-05");
    expect(outcome.content).not.toContain(CUSTOMER);
    expect(outcome.content).not.toContain("+914412345678");
    expect(outcome.content).not.toMatch(/phone|email|contact/i);
  });
});

describe("UT-ai-tool-propose-visit: a project that is not open for a visit is an error, never data", () => {
  it.each([
    ["never listed, or a slug nobody uses", "no-such-project"],
    ["waiting for review or not published", "kadal-vista"],
    ["of a builder who is not active", "kadal-bay"],
  ])(
    "answers not_available for a project that is %s, without asking who is calling",
    async (_case, slug) => {
      getProject.mockResolvedValue({ status: "missing", readAt: READ_AT });
      expect(await propose({ slug, visitDate: "2026-12-05", message: MESSAGE })).toEqual({
        status: "error",
        code: "not_available",
        fields: [],
        content: expect.stringContaining('"error":"not_available"'),
      });
      expect(getSessionView).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    },
  );
});

describe("UT-ai-tool-propose-visit: a visitor who is not signed in", () => {
  it("gets sign_in_required with the project, and no proposal and nothing signed", async () => {
    getSessionView.mockResolvedValue(null);
    const outcome = await visit("2026-12-05");
    expect(outcome).toEqual({
      status: "ok",
      output: {
        status: "sign_in_required",
        asOf: AS_OF_TEXT,
        target: { slug: "kadal-vista" },
        // The day and the message are kept for the card that asks the visitor to sign in.
        visitDate: "2026-12-05",
        untrustedText: { name: "Kadal Vista", message: expect.any(String) },
      },
      references: [{ kind: "project", slug: "kadal-vista" }],
      content: expect.any(String),
    });
    expect(outcome.content).not.toContain("proposal");
  });

  it("still answers not_available for a project that is not open, so a visitor learns nothing more", async () => {
    getSessionView.mockResolvedValue(null);
    getProject.mockResolvedValue({ status: "missing", readAt: READ_AT });
    expect(await visit("2026-12-05")).toMatchObject({ status: "error", code: "not_available" });
  });
});

describe("UT-ai-tool-propose-visit: when something fails, nothing is proposed", () => {
  it("answers 'unavailable', not 'not_available', when the project cannot be read", async () => {
    getProject.mockRejectedValue(new Error("project could not be read"));
    expect(await visit("2026-12-05")).toMatchObject({ status: "error", code: "unavailable" });
    expect(error).toHaveBeenCalledExactlyOnceWith("ai tool could not run", {
      tool: "propose_site_visit",
    });
  });

  it("does not propose when the session cannot be read", async () => {
    getSessionView.mockRejectedValue(new Error("the session could not be read"));
    expect(await visit("2026-12-05")).toMatchObject({ status: "error", code: "unavailable" });
  });

  it("does not propose when the secret is not set, so an unsigned card is never made", async () => {
    settings.env.RATE_LIMIT_HMAC_SECRET = undefined;
    const outcome = await visit("2026-12-05");
    expect(outcome).toMatchObject({ status: "error", code: "unavailable" });
    expect(outcome.content).not.toContain("proposal");
  });
});
