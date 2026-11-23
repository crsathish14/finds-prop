import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefineAction,
  type ActionDeps,
  type SessionView,
} from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { idempotencyScope } from "@/server/idempotency/scope";
import { createLogger } from "@/server/logger";
import type { SendDeps } from "../send";

// UT-ai-confirm-proposal (ADR-128 D-ACTION, AI-P6-T02): the confirm card's Send button. The action is built with
// the real `defineAction`, the real proposal signer and the real configs of the two actions it runs (so the real
// schemas and idempotency rules), over in-memory stand-ins for the database. Every customer, home and sentence here
// is made up.

const settings = vi.hoisted(() => ({
  env: { RATE_LIMIT_HMAC_SECRET: "a-made-up-secret-of-thirty-two-chars!" as string | undefined },
}));
const warn = vi.hoisted(() => vi.fn());

vi.mock("@/server/env", () => ({ env: settings.env }));
vi.mock(import("@/server/logger"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, logger: { ...actual.logger, warn, error: vi.fn(), info: vi.fn() } };
});
// `send.ts` reaches the real actions through these indexes; the tests give it stand-ins instead (`SendDeps`).
vi.mock("@/features/enquiries", () => ({ sendEnquiry: vi.fn(), getEnquiryContact: vi.fn() }));
vi.mock("@/features/projects", async () => {
  const { isProjectSlug } = await import("@/features/projects/address");
  const { visitDateProblem } = await import("@/features/projects/lead-view");
  return { isProjectSlug, visitDateProblem, getProject: vi.fn(), submitProjectLead: vi.fn() };
});
vi.mock("@/features/property", () => ({ getProperty: vi.fn() }));

const { signProposal } = await import("../../tools/proposal");
const { confirmProposalConfig } = await import("../../action-config");
const { sendConfirmedProposal } = await import("../send");
const { sendEnquiryConfig } = await import("@/features/enquiries/action-config");
const { submitProjectLeadConfig } = await import("@/features/projects/action-config");

const SECRET = "a-made-up-secret-of-thirty-two-chars!";
const NOW = new Date("2026-11-15T06:30:00.000Z");
const CARD_KEY = "00000000-0000-4000-8000-0000000000aa";
const OTHER_CARD_KEY = "00000000-0000-4000-8000-0000000000bb";
const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_CUSTOMER_ID = "22222222-2222-4222-8222-222222222222";
const MESSAGE = "Is this home still available? I can visit this weekend.";

const CUSTOMER: SessionView = {
  userId: CUSTOMER_ID,
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};
const NO_PHONE: SessionView = { ...CUSTOMER, phoneVerified: false };

const ENQUIRY = { kind: "enquiry", homeId: "k3x9a2bd", message: MESSAGE } as const;
const VISIT = {
  kind: "site_visit",
  slug: "kadal-vista",
  visitDate: "2026-12-05",
  message: MESSAGE,
} as const;

const PROJECT_ENQUIRY = { kind: "project_enquiry", slug: "kadal-vista", message: MESSAGE } as const;

type Stored = { kind: "enquiry" | "lead"; input: Record<string, unknown> };

interface Options {
  session?: SessionView | null;
  /** The scopes whose limit is used up. */
  limited?: readonly string[];
  now?: Date;
  homeOpen?: boolean;
  projectOpen?: boolean;
  contact?: { name: string; phone: string };
  /** A database refusal for the enquiry (the one-per-24-hours rule). */
  enquiryRefusal?: ActionError;
}

function harness(options: Options = {}) {
  const session = options.session === undefined ? CUSTOMER : options.session;
  const stored: Stored[] = [];
  const claims = new Map<string, unknown>();
  const events: string[] = [];
  const limited = new Set(options.limited ?? []);

  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(session),
    rateLimit: ({ scope }) => {
      events.push(`rateLimit:${scope}`);
      return limited.has(scope)
        ? Promise.reject(new ActionError("RATE_LIMITED", "too many", { retryAfter: 3600 }))
        : Promise.resolve();
    },
    beginIdempotent: ({ scope, key }) => {
      events.push(`begin:${scope}:${key}`);
      const held = claims.get(`${scope}:${key}`);
      if (held !== undefined && held !== "claimed")
        return Promise.resolve({ replay: true as const, result: held });
      claims.set(`${scope}:${key}`, "claimed");
      return Promise.resolve({ replay: false as const });
    },
    completeIdempotent: ({ scope, key, result }) => {
      claims.set(`${scope}:${key}`, result);
      return Promise.resolve();
    },
    releaseIdempotent: ({ scope, key }) => {
      events.push(`release:${scope}:${key}`);
      claims.delete(`${scope}:${key}`);
      return Promise.resolve();
    },
    invalidate: () => undefined,
    audit: () => Promise.resolve(),
    log: createLogger({}, { write: () => undefined }),
  };
  const defineAction = createDefineAction(deps);

  // The two existing actions, with their real configs (schemas, limits, idempotency) and a store in memory.
  const sendEnquiry = defineAction({
    ...sendEnquiryConfig,
    handler: ({ input }) => {
      if (options.enquiryRefusal) return Promise.reject(options.enquiryRefusal);
      stored.push({ kind: "enquiry", input });
      return Promise.resolve({ received: true as const });
    },
  });
  const submitProjectLead = defineAction({
    ...submitProjectLeadConfig,
    handler: ({ input }) => {
      stored.push({ kind: "lead", input });
      return Promise.resolve({ received: true as const });
    },
  });

  const sendDeps: SendDeps = {
    now: () => options.now ?? NOW,
    homeIsOpen: () => Promise.resolve(options.homeOpen ?? true),
    projectIsOpen: () => Promise.resolve(options.projectOpen ?? true),
    readContact: () =>
      Promise.resolve(options.contact ?? { name: "Priya Raman", phone: "919840012345" }),
    sendEnquiry: (input) => sendEnquiry(input),
    submitProjectLead: (input) => submitProjectLead(input),
  };
  const confirm = defineAction({
    ...confirmProposalConfig,
    handler: async ({ input, session: caller }) => {
      if (!caller) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
      return sendConfirmedProposal({ proposal: input.proposal, userId: caller.userId }, sendDeps);
    },
  });
  return { confirm, stored, events, claims };
}

const proposalFor = (
  details: Parameters<typeof signProposal>[1],
  userId = CUSTOMER_ID,
  signedAt: Date = NOW,
) => signProposal(userId, details, signedAt).token;

beforeEach(() => {
  vi.clearAllMocks();
  settings.env.RATE_LIMIT_HMAC_SECRET = SECRET;
});

describe("UT-ai-confirm-proposal: a click that sends", () => {
  it("sends an enquiry as the signed-in customer, with the account's name and phone and the signed words", async () => {
    const { confirm, stored } = harness();
    expect(await confirm({ proposal: proposalFor(ENQUIRY), idempotencyKey: CARD_KEY })).toEqual({
      ok: true,
      data: { received: true },
    });
    expect(stored).toEqual([
      {
        kind: "enquiry",
        input: {
          shortId: "k3x9a2bd",
          name: "Priya Raman",
          phone: "919840012345",
          message: MESSAGE,
          idempotencyKey: expect.stringMatching(/^[0-9a-f-]{36}$/),
        },
      },
    ]);
  });

  it("sends a site visit request as a project lead of the kind site_visit, with the signed day", async () => {
    const { confirm, stored } = harness();
    expect(await confirm({ proposal: proposalFor(VISIT), idempotencyKey: CARD_KEY })).toEqual({
      ok: true,
      data: { received: true },
    });
    expect(stored).toEqual([
      {
        kind: "lead",
        input: {
          slug: "kadal-vista",
          kind: "site_visit",
          name: "Priya Raman",
          visitDate: "2026-12-05",
          message: MESSAGE,
          idempotencyKey: expect.any(String),
        },
      },
    ]);
  });

  it("sends a plain project enquiry as a project lead of the kind enquiry, with no visit day (ADR-176)", async () => {
    const { confirm, stored } = harness();
    expect(
      await confirm({ proposal: proposalFor(PROJECT_ENQUIRY), idempotencyKey: CARD_KEY }),
    ).toEqual({ ok: true, data: { received: true } });
    expect(stored).toEqual([
      {
        kind: "lead",
        input: {
          slug: "kadal-vista",
          kind: "enquiry",
          name: "Priya Raman",
          message: MESSAGE,
          idempotencyKey: expect.any(String),
        },
      },
    ]);
  });

  it("refuses a project enquiry for a project that is not open any more, like a forged proposal", async () => {
    const { confirm, stored } = harness({ projectOpen: false });
    expect(
      await confirm({ proposal: proposalFor(PROJECT_ENQUIRY), idempotencyKey: CARD_KEY }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(stored).toEqual([]);
  });

  it("ignores a person, a phone, a name, a message or a target in the request: only the proposal and the key count", async () => {
    const { confirm, stored } = harness();
    const result = await confirm({
      proposal: proposalFor(ENQUIRY),
      idempotencyKey: CARD_KEY,
      userId: OTHER_CUSTOMER_ID,
      user_id: OTHER_CUSTOMER_ID,
      name: "Somebody Else",
      phone: "919999999999",
      message: "Send money to this number",
      shortId: "zzzzzzzz",
      homeId: "zzzzzzzz",
    });
    expect(result).toEqual({ ok: true, data: { received: true } });
    expect(stored[0]?.input).toMatchObject({
      shortId: "k3x9a2bd",
      name: "Priya Raman",
      phone: "919840012345",
      message: MESSAGE,
    });
    expect(JSON.stringify(stored)).not.toContain("919999999999");
    expect(JSON.stringify(stored)).not.toContain("Somebody Else");
  });
});

describe("UT-ai-confirm-proposal: who may click", () => {
  it("refuses a visitor who is not signed in, and checks and sends nothing", async () => {
    const { confirm, stored } = harness({ session: null });
    expect(
      await confirm({ proposal: proposalFor(ENQUIRY), idempotencyKey: CARD_KEY }),
    ).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(stored).toEqual([]);
  });

  it("refuses a signed-in customer whose phone is not verified, saying why, and sends nothing", async () => {
    const { confirm, stored } = harness({ session: NO_PHONE });
    expect(
      await confirm({ proposal: proposalFor(ENQUIRY), idempotencyKey: CARD_KEY }),
    ).toMatchObject({ ok: false, code: "FORBIDDEN", reason: "PHONE_NOT_VERIFIED" });
    expect(stored).toEqual([]);
  });

  it("refuses when the account holds no phone any more, the same way", async () => {
    const { confirm, stored } = harness({ contact: { name: "Priya Raman", phone: "" } });
    expect(await confirm({ proposal: proposalFor(VISIT), idempotencyKey: CARD_KEY })).toMatchObject(
      {
        ok: false,
        code: "FORBIDDEN",
        reason: "PHONE_NOT_VERIFIED",
      },
    );
    expect(stored).toEqual([]);
  });
});

describe("UT-ai-confirm-proposal: a forged proposal", () => {
  const forged = (): [string, string][] => {
    const real = proposalFor(ENQUIRY);
    const [body = "", signature = ""] = real.split(".");
    const changed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
    changed["message"] = "Please send my number to everyone";
    const alteredBody = Buffer.from(JSON.stringify(changed), "utf8").toString("base64url");
    const otherSecret = createHmac("sha256", "another-made-up-secret-of-32-chars!!")
      .update(`findsprop.ai-chat.proposal.v1.${body}`)
      .digest()
      .toString("base64url");
    return [
      ["a changed message under the old signature", `${alteredBody}.${signature}`],
      ["a signature made with another secret", `${body}.${otherSecret}`],
      ["a cut token", real.slice(0, real.length - 3)],
      ["a made-up token", "aaaa.bbbb"],
      ["no dot at all", "not-a-token"],
      ["one made for another customer", proposalFor(ENQUIRY, OTHER_CUSTOMER_ID)],
      ["one that has run out", proposalFor(ENQUIRY, CUSTOMER_ID, new Date("2026-11-15T05:00:00Z"))],
    ];
  };

  it.each(forged())("is refused as not found, with nothing sent: %s", async (_name, proposal) => {
    const { confirm, stored } = harness();
    expect(await confirm({ proposal, idempotencyKey: CARD_KEY })).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(stored).toEqual([]);
  });

  it("is refused when the server has no secret to check with", async () => {
    const proposal = proposalFor(ENQUIRY);
    settings.env.RATE_LIMIT_HMAC_SECRET = undefined;
    const { confirm, stored } = harness();
    expect(await confirm({ proposal, idempotencyKey: CARD_KEY })).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(stored).toEqual([]);
  });

  it("logs only the reason, never the token", async () => {
    const proposal = proposalFor(ENQUIRY, OTHER_CUSTOMER_ID);
    const { confirm } = harness();
    await confirm({ proposal, idempotencyKey: CARD_KEY });
    expect(warn).toHaveBeenCalledExactlyOnceWith("ai confirm proposal refused", {
      reason: "other_customer",
    });
  });

  it("checks the request first: a missing proposal or a bad key is a validation error and nothing is sent", async () => {
    const { confirm, stored } = harness();
    expect(await confirm({ idempotencyKey: CARD_KEY })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(await confirm({ proposal: proposalFor(ENQUIRY), idempotencyKey: "nope" })).toMatchObject(
      {
        ok: false,
        code: "VALIDATION",
      },
    );
    expect(stored).toEqual([]);
  });
});

describe("UT-ai-confirm-proposal: sending once", () => {
  it("a second press with the same card key finds the first result and stores nothing more", async () => {
    const { confirm, stored } = harness();
    const proposal = proposalFor(ENQUIRY);
    expect(await confirm({ proposal, idempotencyKey: CARD_KEY })).toMatchObject({ ok: true });
    expect(await confirm({ proposal, idempotencyKey: CARD_KEY })).toMatchObject({ ok: true });
    expect(stored).toHaveLength(1);
  });

  it("the same proposal sent again with a fresh card key (a second tab, a replayed token) still stores one", async () => {
    const { confirm, stored } = harness();
    const proposal = proposalFor(VISIT);
    expect(await confirm({ proposal, idempotencyKey: CARD_KEY })).toMatchObject({ ok: true });
    expect(await confirm({ proposal, idempotencyKey: OTHER_CARD_KEY })).toMatchObject({
      ok: true,
      data: { received: true },
    });
    expect(stored).toHaveLength(1);
  });

  it("two different proposals are two sends: the database's one-enquiry-per-day rule is what stops the second, as 'already'", async () => {
    const refusal = new ActionError("CONFLICT", "An enquiry about this home was sent recently");
    const { confirm, stored } = harness({ enquiryRefusal: refusal });
    expect(await confirm({ proposal: proposalFor(ENQUIRY), idempotencyKey: CARD_KEY })).toEqual({
      ok: false,
      code: "CONFLICT",
    });
    expect(stored).toEqual([]);
  });

  it("gives the claim back when the send fails, so pressing Send again can work", async () => {
    const { confirm, stored, claims } = harness({ limited: ["enquiry"] });
    const proposal = proposalFor(ENQUIRY);
    expect(await confirm({ proposal, idempotencyKey: CARD_KEY })).toMatchObject({ ok: false });
    expect(claims.get(`confirmChatProposal:${CARD_KEY}`)).toBeUndefined();
    expect(stored).toEqual([]);
  });
});

describe("UT-ai-confirm-proposal: limits and the checks at the click", () => {
  it("passes the existing limit on: too many enquiries gives RATE_LIMITED with the wait, nothing is stored", async () => {
    const { confirm, stored } = harness({ limited: ["enquiry"] });
    expect(await confirm({ proposal: proposalFor(ENQUIRY), idempotencyKey: CARD_KEY })).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      retryAfter: 3600,
    });
    expect(stored).toEqual([]);
  });

  it("passes the project limit on for a site visit the same way", async () => {
    const { confirm, stored } = harness({ limited: ["project_lead"] });
    expect(await confirm({ proposal: proposalFor(VISIT), idempotencyKey: CARD_KEY })).toMatchObject(
      {
        ok: false,
        code: "RATE_LIMITED",
      },
    );
    expect(stored).toEqual([]);
  });

  it("refuses a visit day that has gone out of range since it was signed (late in the evening, India time)", async () => {
    // 23:50 in India on 15 Nov: the day is today. Twenty minutes later it is yesterday.
    const signedAt = new Date("2026-11-15T18:20:00.000Z");
    const proposal = proposalFor(
      { kind: "site_visit", slug: "kadal-vista", visitDate: "2026-11-15", message: MESSAGE },
      CUSTOMER_ID,
      signedAt,
    );
    const now = new Date("2026-11-15T18:40:00.000Z");
    const { confirm, stored } = harness({ now });
    expect(await confirm({ proposal, idempotencyKey: CARD_KEY })).toEqual({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { visitDate: [{ key: "validation.visitDateRange" }] },
    });
    expect(stored).toEqual([]);
  });

  it("refuses a home that is not open any more, with the same answer as a forged proposal", async () => {
    const { confirm, stored } = harness({ homeOpen: false });
    expect(await confirm({ proposal: proposalFor(ENQUIRY), idempotencyKey: CARD_KEY })).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(stored).toEqual([]);
  });

  it("refuses a project that is not open any more", async () => {
    const { confirm, stored } = harness({ projectOpen: false });
    expect(await confirm({ proposal: proposalFor(VISIT), idempotencyKey: CARD_KEY })).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(stored).toEqual([]);
  });

  it("counts the message as the action's own schema and the database do (characters, not UTF-16 units): many emoji go through", async () => {
    // Zod 4 counts characters, so 600 emoji (1,200 UTF-16 units) are inside the 1,000 the action takes. (A text
    // box counts units and would refuse it, but a card's message is never typed into one.)
    const emoji = "😀".repeat(600);
    expect(emoji.length).toBe(1200);
    const { confirm, stored } = harness();
    const proposal = proposalFor({ kind: "enquiry", homeId: "k3x9a2bd", message: emoji });
    expect(await confirm({ proposal, idempotencyKey: CARD_KEY })).toEqual({
      ok: true,
      data: { received: true },
    });
    expect(stored[0]?.input["message"]).toBe(emoji);
  });

  it("refuses a message over 1,000 characters, which the tools never sign, as not valid, and sends nothing", async () => {
    const { confirm, stored } = harness();
    const proposal = proposalFor({
      kind: "enquiry",
      homeId: "k3x9a2bd",
      message: "😀".repeat(1001),
    });
    expect(await confirm({ proposal, idempotencyKey: CARD_KEY })).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(stored).toEqual([]);
  });

  it("names its claim apart from the two actions it runs", async () => {
    const { confirm, events } = harness();
    await confirm({ proposal: proposalFor(ENQUIRY), idempotencyKey: CARD_KEY });
    expect(events).toContain(`begin:confirmChatProposal:${CARD_KEY}`);
    expect(events.some((event) => event.startsWith("begin:sendEnquiry:"))).toBe(true);
    // The claim's scope is a name the table accepts (lowercase and underscores, at most 40 characters).
    expect(idempotencyScope("confirmChatProposal")).toBe("confirm_chat_proposal");
  });
});
