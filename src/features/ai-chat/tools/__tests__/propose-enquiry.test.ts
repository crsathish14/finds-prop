import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROPOSAL_MESSAGE_MAX_CHARACTERS } from "@/config/ai";
import { AS_OF_TEXT, injected, propertyData, READ_AT, stringsIn, TOOL_CONTEXT } from "./fixtures";

// UT-ai-tool-propose-enquiry (ADR-128 section 5.3): `propose_enquiry` checks and prepares, and writes nothing.
// The reads, the session and the signing secret are stand-ins; the home, the customer and the words are made up.

const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const MESSAGE = "Is this home still available? I can visit this weekend.";

const settings = vi.hoisted(() => ({
  env: { RATE_LIMIT_HMAC_SECRET: "a-made-up-secret-of-thirty-two-chars!" as string | undefined },
}));
const getProperty = vi.fn();
const getSessionView = vi.fn();
const ownsHome = vi.fn();
const createAdminSupabase = vi.fn();
const error = vi.fn();

vi.mock("@/server/env", () => ({ env: settings.env }));
vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
vi.mock("@/features/property", async () => {
  const { amenityList, perSqftRupees } = await import("@/features/property/view");
  return { getProperty, amenityList, perSqftRupees };
});
vi.mock("@/features/projects", async () => {
  const { isProjectSlug } = await import("@/features/projects/address");
  return { isProjectSlug };
});
vi.mock("@/server/auth/get-session-view", () => ({ getSessionView }));
vi.mock("../../queries", () => ({ ownsHome }));
// A write would go through the service role. The tool must never reach for it.
vi.mock("@/server/supabase/admin.server", () => ({ createAdminSupabase }));

const { toPortableJsonSchema } = await import("@/server/ai");
const { runTool } = await import("../run");
const { verifyProposal } = await import("../proposal");
const { proposeEnquiryInputSchema, proposeEnquiryTool } = await import("../propose-enquiry");

const propose = (input: unknown) =>
  runTool([proposeEnquiryTool], { name: "propose_enquiry", input }, TOOL_CONTEXT);

const found = (overrides: Parameters<typeof propertyData>[0] = {}) => ({
  status: "found",
  property: propertyData(overrides),
  readAt: READ_AT,
});

const okOutput = (outcome: Awaited<ReturnType<typeof propose>>) => {
  if (outcome.status !== "ok") throw new Error(`not ok: ${outcome.content}`);
  return outcome.output as Record<string, unknown>;
};

beforeEach(() => {
  vi.clearAllMocks();
  settings.env.RATE_LIMIT_HMAC_SECRET = "a-made-up-secret-of-thirty-two-chars!";
  getProperty.mockResolvedValue(found());
  getSessionView.mockResolvedValue({
    userId: CUSTOMER,
    roles: ["customer"],
    phoneVerified: true,
    builderId: null,
  });
  ownsHome.mockResolvedValue(false);
});

describe("UT-ai-tool-propose-enquiry: the input", () => {
  it("is called propose_enquiry, is a propose tool, and takes a home id and a message and nothing else", () => {
    expect(proposeEnquiryTool.name).toBe("propose_enquiry");
    expect(proposeEnquiryTool.kind).toBe("propose");
    expect(toPortableJsonSchema(proposeEnquiryInputSchema)).toMatchObject({
      type: "object",
      properties: { homeId: { type: "string" }, message: { type: "string" } },
      required: ["homeId", "message"],
      additionalProperties: false,
    });
  });

  it("ignores a person the model tries to add: the customer is only ever the session", async () => {
    const outcome = await propose({
      homeId: "k3x9a2bd",
      message: MESSAGE,
      userId: "99999999-9999-4999-8999-999999999999",
      ownerId: "made-up-owner",
    });
    const proposal = okOutput(outcome).proposal as string;
    expect(verifyProposal(proposal, CUSTOMER).status).toBe("valid");
    expect(outcome.content).not.toContain("99999999-9999-4999-8999-999999999999");
  });

  it.each([
    ["nothing", ""],
    ["too few characters", "k3x9a2b"],
    ["a look-alike character the ids never use", "k3x9a2b0"],
    ["a whole address", "3-bhk-apartment-velachery-k3x9a2bd"],
    ["a database id", "6f1d8a52-0c3e-4b7a-9d21-5e8f4c2a7b10"],
    ["a number", 12345678],
    ["no id", null],
  ])("refuses %s as an id and reads nothing", async (_case, homeId) => {
    expect(await propose({ homeId, message: MESSAGE })).toMatchObject({
      status: "error",
      code: "invalid_input",
      fields: ["homeId"],
    });
    expect(getProperty).not.toHaveBeenCalled();
    expect(getSessionView).not.toHaveBeenCalled();
  });

  it.each([
    ["no message", ""],
    ["only spaces", "   \n  "],
    ["a message too long", "x".repeat(PROPOSAL_MESSAGE_MAX_CHARACTERS + 1)],
    ["a number", 7],
    ["no message at all", null],
  ])("refuses %s and reads nothing", async (_case, message) => {
    expect(await propose({ homeId: "k3x9a2bd", message })).toMatchObject({
      status: "error",
      code: "invalid_input",
      fields: ["message"],
    });
    expect(getProperty).not.toHaveBeenCalled();
  });

  it("refuses a message that is nothing but characters that show nothing, so a blank card is never made", async () => {
    expect(await propose({ homeId: "k3x9a2bd", message: "​⁠‮" })).toMatchObject({
      status: "error",
      code: "invalid_input",
      fields: ["message"],
    });
    expect(getProperty).not.toHaveBeenCalled();
    expect(getSessionView).not.toHaveBeenCalled();
  });

  it("accepts a message of exactly the longest length, counting a Tamil letter as one", async () => {
    const message = "வ".repeat(PROPOSAL_MESSAGE_MAX_CHARACTERS);
    expect(okOutput(await propose({ homeId: "k3x9a2bd", message }))).toMatchObject({
      status: "ready",
    });
  });

  it("reads capitals and stray spaces in the id as the property page does", async () => {
    await propose({ homeId: " K3X9A2BD ", message: MESSAGE });
    expect(getProperty).toHaveBeenCalledExactlyOnceWith("k3x9a2bd");
  });
});

describe("UT-ai-tool-propose-enquiry: a home that is open, for a signed-in customer", () => {
  it("returns what the card needs with a proposal signed for this customer, and writes nothing", async () => {
    const outcome = await propose({ homeId: "k3x9a2bd", message: `  ${MESSAGE}​ ` });
    expect(outcome).toEqual({
      status: "ok",
      output: {
        status: "ready",
        asOf: AS_OF_TEXT,
        expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/),
        proposal: expect.any(String),
        target: { homeId: "k3x9a2bd" },
        untrustedText: { title: "3 BHK apartment with clubhouse", message: MESSAGE },
      },
      references: [{ kind: "home", homeId: "k3x9a2bd", slug: "3-bhk-apartment-velachery" }],
      content: expect.any(String),
    });
    expect(JSON.parse(outcome.content)).toEqual(outcome.status === "ok" ? outcome.output : null);
    expect(createAdminSupabase).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it("signs the home, the message and the customer, and the proposal reads back the same", async () => {
    const output = okOutput(await propose({ homeId: "k3x9a2bd", message: MESSAGE }));
    const check = verifyProposal(output.proposal, CUSTOMER);
    expect(check).toMatchObject({
      status: "valid",
      proposal: { kind: "enquiry", homeId: "k3x9a2bd", message: MESSAGE, userId: CUSTOMER },
    });
    // Another customer cannot use it.
    expect(verifyProposal(output.proposal, "22222222-2222-4222-8222-222222222222")).toEqual({
      status: "refused",
      reason: "other_customer",
    });
  });

  it("checks the home is not the caller's own by the database's answer for the session, with the home's id only", async () => {
    await propose({ homeId: "k3x9a2bd", message: MESSAGE });
    expect(ownsHome).toHaveBeenCalledExactlyOnceWith("k3x9a2bd");
    expect(getSessionView).toHaveBeenCalledOnce();
  });

  it("keeps everything a third party typed under untrustedText, and nowhere else", async () => {
    getProperty.mockResolvedValue(found({ title: injected("title") }));
    const outcome = await propose({ homeId: "k3x9a2bd", message: MESSAGE });
    const typed = stringsIn(outcome.status === "ok" ? outcome.output : null).filter(({ text }) =>
      text.includes("Zzinject"),
    );
    expect(typed.map(({ path }) => path.join("."))).toEqual(["untrustedText.title"]);
  });

  it("gives the model no owner, no phone, no email and no customer id", async () => {
    const outcome = await propose({ homeId: "k3x9a2bd", message: MESSAGE });
    expect(outcome.content).not.toContain(CUSTOMER);
    expect(outcome.content).not.toMatch(/owner|phone|email/i);
  });
});

describe("UT-ai-tool-propose-enquiry: a home that is not open for an enquiry is an error, never data", () => {
  it.each([
    ["never listed, or an id nobody uses", "m7p4q9wz"],
    ["waiting for review or rejected", "n5z7c4dh"],
    ["withdrawn, sold or rented", "k3x9a2bd"],
    ["someone else's draft", "q2r3s4tu"],
  ])(
    "answers not_available for a home that is %s, without asking who is calling",
    async (_case, homeId) => {
      getProperty.mockResolvedValue({ status: "missing", readAt: READ_AT });
      expect(await propose({ homeId, message: MESSAGE })).toEqual({
        status: "error",
        code: "not_available",
        fields: [],
        content: expect.stringContaining('"error":"not_available"'),
      });
      expect(getSessionView).not.toHaveBeenCalled();
      expect(ownsHome).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    },
  );

  it("answers own_home when the signed-in customer owns the home, with no proposal", async () => {
    ownsHome.mockResolvedValue(true);
    const outcome = await propose({ homeId: "k3x9a2bd", message: MESSAGE });
    expect(outcome).toEqual({
      status: "error",
      code: "own_home",
      fields: [],
      content: expect.stringContaining('"error":"own_home"'),
    });
    expect(outcome.content).not.toContain("proposal");
    expect(error).not.toHaveBeenCalled();
  });

  it("gives the model a line to act on, not the reason behind it", async () => {
    getProperty.mockResolvedValue({ status: "missing", readAt: READ_AT });
    const outcome = await propose({ homeId: "k3x9a2bd", message: MESSAGE });
    expect(JSON.parse(outcome.content)).toEqual({
      error: "not_available",
      hint: expect.stringContaining("not available"),
    });
  });
});

describe("UT-ai-tool-propose-enquiry: a visitor who is not signed in", () => {
  it("gets sign_in_required with the home, and no proposal, no ownership check and nothing signed", async () => {
    getSessionView.mockResolvedValue(null);
    const outcome = await propose({ homeId: "k3x9a2bd", message: MESSAGE });
    expect(outcome).toEqual({
      status: "ok",
      output: {
        status: "sign_in_required",
        asOf: AS_OF_TEXT,
        target: { homeId: "k3x9a2bd" },
        untrustedText: { title: "3 BHK apartment with clubhouse" },
      },
      references: [{ kind: "home", homeId: "k3x9a2bd", slug: "3-bhk-apartment-velachery" }],
      content: expect.any(String),
    });
    expect(ownsHome).not.toHaveBeenCalled();
    expect(outcome.content).not.toContain("proposal");
  });

  it("still answers not_available for a home that is not open, so a visitor learns nothing more", async () => {
    getSessionView.mockResolvedValue(null);
    getProperty.mockResolvedValue({ status: "missing", readAt: READ_AT });
    expect(await propose({ homeId: "k3x9a2bd", message: MESSAGE })).toMatchObject({
      status: "error",
      code: "not_available",
    });
  });
});

describe("UT-ai-tool-propose-enquiry: when something fails, nothing is proposed", () => {
  it("answers 'unavailable', not 'not_available', when the home cannot be read", async () => {
    getProperty.mockRejectedValue(new Error("property could not be read"));
    expect(await propose({ homeId: "k3x9a2bd", message: MESSAGE })).toMatchObject({
      status: "error",
      code: "unavailable",
    });
    expect(error).toHaveBeenCalledExactlyOnceWith("ai tool could not run", {
      tool: "propose_enquiry",
    });
  });

  it("does not propose when the session cannot be read", async () => {
    getSessionView.mockRejectedValue(new Error("the session could not be read"));
    expect(await propose({ homeId: "k3x9a2bd", message: MESSAGE })).toMatchObject({
      status: "error",
      code: "unavailable",
    });
  });

  it("does not propose when ownership cannot be checked: a failed check is not 'does not own it'", async () => {
    ownsHome.mockRejectedValue(new Error("the caller's own homes could not be read"));
    const outcome = await propose({ homeId: "k3x9a2bd", message: MESSAGE });
    expect(outcome).toMatchObject({ status: "error", code: "unavailable" });
    expect(outcome.content).not.toContain("proposal");
  });

  it("does not propose when the secret is not set, so an unsigned card is never made", async () => {
    settings.env.RATE_LIMIT_HMAC_SECRET = undefined;
    const outcome = await propose({ homeId: "k3x9a2bd", message: MESSAGE });
    expect(outcome).toMatchObject({ status: "error", code: "unavailable" });
    expect(outcome.content).not.toContain("proposal");
  });

  it("never logs what the customer wrote", async () => {
    getProperty.mockRejectedValue(new Error("property could not be read"));
    await propose({ homeId: "k3x9a2bd", message: MESSAGE });
    expect(JSON.stringify(error.mock.calls)).not.toContain(MESSAGE);
    expect(JSON.stringify(error.mock.calls)).not.toContain("k3x9a2bd");
  });
});
