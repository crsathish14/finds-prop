import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROPOSAL_MESSAGE_MAX_CHARACTERS } from "@/config/ai";
import { AS_OF_TEXT, injected, projectData, READ_AT, stringsIn, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-propose-project-enquiry (ADR-176): `propose_project_enquiry` checks and prepares, and writes nothing.
// The read, the session and the signing secret are stand-ins; the project, the customer and the words are made up.

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const MESSAGE = "I am looking for a 2 BHK, my budget is 80 lakh and I need a loan.";
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
  return { getProject, isProjectSlug };
});
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView }));
// A write would go through the service role. The tool must never reach for it.
vi.mock("@/server/supabase/admin.server", () => ({ createAdminSupabase }));

const { runTool } = await import("../run");
const { verifyProposal } = await import("../proposal");
const { proposeProjectEnquiryInputSchema, proposeProjectEnquiryTool } =
  await import("../propose-project-enquiry");

const propose = (input: unknown) =>
  runTool([proposeProjectEnquiryTool], { name: "propose_project_enquiry", input }, TOOL_CONTEXT);

const enquire = (extra: Record<string, unknown> = {}) =>
  propose({ slug: "kadal-vista", message: MESSAGE, ...extra });

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

describe("UT-ai-tool-propose-project-enquiry: the input", () => {
  it("is a propose tool that takes a project and a message, and no day and no person", () => {
    expect(proposeProjectEnquiryTool.name).toBe("propose_project_enquiry");
    expect(proposeProjectEnquiryTool.kind).toBe("propose");
    expect(Object.keys(proposeProjectEnquiryInputSchema.shape).sort()).toEqual(["message", "slug"]);
  });

  it("tells the model to ask first, to use what the customer said, and that a typed yes never sends", () => {
    const description = proposeProjectEnquiryTool.description;
    expect(description).toContain("or accepts your offer");
    expect(description).toContain("Never use it on your own");
    expect(description).toContain("only as they said it");
    expect(description).toContain('A typed "yes" never sends');
  });

  it.each([
    ["no slug", { message: MESSAGE }],
    ["a slug that is not one", { slug: "Not A Slug!", message: MESSAGE }],
    ["no message", { slug: "kadal-vista" }],
    ["an empty message", { slug: "kadal-vista", message: "   " }],
    [
      "a message that is too long",
      { slug: "kadal-vista", message: "a".repeat(PROPOSAL_MESSAGE_MAX_CHARACTERS + 1) },
    ],
  ])("refuses %s as invalid input and reads nothing", async (_case, input) => {
    const outcome = await propose(input);
    expect(outcome.status).toBe("error");
    expect(outcome.status === "error" ? outcome.code : "").toBe("invalid_input");
    expect(getProject).not.toHaveBeenCalled();
    expect(getSessionView).not.toHaveBeenCalled();
  });
});

describe("UT-ai-tool-propose-project-enquiry: a project that is open, for a signed-in customer", () => {
  it("returns what the card needs with a proposal signed for this customer, and writes nothing", async () => {
    const outcome = await enquire();
    expect(outcome).toEqual({
      status: "ok",
      output: {
        status: "ready",
        asOf: AS_OF_TEXT,
        expiresAt: "2026-11-15T07:00:00.000Z",
        proposal: expect.any(String),
        target: { slug: "kadal-vista" },
        untrustedText: { name: "Kadal Vista", message: MESSAGE },
      },
      references: [{ kind: "project", slug: "kadal-vista" }],
      content: expect.any(String),
    });
    expect(createAdminSupabase).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("signs the project, the message and the customer, and no day", async () => {
    const output = okOutput(await enquire());
    const check = verifyProposal(output.proposal, CUSTOMER, NOW);
    expect(check).toMatchObject({
      status: "valid",
      proposal: {
        kind: "project_enquiry",
        slug: "kadal-vista",
        message: MESSAGE,
        userId: CUSTOMER,
      },
    });
    expect(check.status === "valid" ? check.proposal : {}).not.toHaveProperty("visitDate");
    expect(verifyProposal(output.proposal, "22222222-2222-4222-8222-222222222222", NOW)).toEqual({
      status: "refused",
      reason: "other_customer",
    });
  });

  it("keeps everything a third party typed under untrustedText, and gives the model no contact and no customer id", async () => {
    getProject.mockResolvedValue(found({ name: injected("project") }));
    const outcome = await enquire();
    const typed = stringsIn(outcome.status === "ok" ? outcome.output : null).filter(({ text }) =>
      text.includes("Zzinject"),
    );
    expect(typed.map(({ path }) => path.join("."))).toEqual(["untrustedText.name"]);
    expect(outcome.content).not.toContain(CUSTOMER);
    expect(outcome.content).not.toContain("+914412345678");
    expect(outcome.content).not.toMatch(/phone|email|contact/i);
  });
});

describe("UT-ai-tool-propose-project-enquiry: a project that is not open, and a visitor", () => {
  it("answers not_available for a project that is not open, without asking who is calling", async () => {
    getProject.mockResolvedValue({ status: "missing", readAt: READ_AT });
    expect(await enquire({ slug: "no-such-project" })).toEqual({
      status: "error",
      code: "not_available",
      fields: [],
      content: expect.stringContaining('"error":"not_available"'),
    });
    expect(getSessionView).not.toHaveBeenCalled();
  });

  it("gives a visitor who is not signed in sign_in_required with the words kept, and no proposal", async () => {
    getSessionView.mockResolvedValue(null);
    const outcome = await enquire();
    expect(outcome).toMatchObject({
      status: "ok",
      output: {
        status: "sign_in_required",
        target: { slug: "kadal-vista" },
        untrustedText: { name: "Kadal Vista", message: MESSAGE },
      },
    });
    expect(outcome.content).not.toContain("proposal");
  });

  it("fails closed when the signing secret is missing: no proposal is made", async () => {
    settings.env.RATE_LIMIT_HMAC_SECRET = undefined;
    const outcome = await enquire();
    expect(outcome.status).not.toBe("ok");
  });
});
