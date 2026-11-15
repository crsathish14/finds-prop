import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROPOSAL_LIFETIME_SECONDS, PROPOSAL_MESSAGE_MAX_CHARACTERS } from "@/config/ai";

// UT-ai-proposal (ADR-128 sections 4.3 D-ACTION and 5.3): a proposal is signed by the server, so a confirm card
// cannot be forged. The customers, homes and words here are made up.

const settings = vi.hoisted(() => ({
  env: { RATE_LIMIT_HMAC_SECRET: "a-made-up-secret-of-thirty-two-chars!" as string | undefined },
}));
const error = vi.fn();

vi.mock("@/server/env", () => ({ env: settings.env }));
vi.mock("@/server/logger", () => ({ logger: { error, warn: vi.fn() } }));
// The projects feature is stood in for by its slug rule, as the tool tests do.
vi.mock("@/features/projects", async () => {
  const { isProjectSlug } = await import("@/features/projects/address");
  return { isProjectSlug };
});

const { signProposal, verifyProposal } = await import("../proposal");

const SECRET = "a-made-up-secret-of-thirty-two-chars!";
const NOW = new Date("2026-11-15T06:30:00.000Z");
const CUSTOMER = "11111111-1111-4111-8111-111111111111";
const OTHER_CUSTOMER = "22222222-2222-4222-8222-222222222222";
const MESSAGE = "Is this home still available? I can visit this weekend.";

const ENQUIRY = { kind: "enquiry", homeId: "k3x9a2bd", message: MESSAGE } as const;
const VISIT = {
  kind: "site_visit",
  slug: "kadal-vista",
  visitDate: "2026-12-05",
  message: MESSAGE,
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  settings.env.RATE_LIMIT_HMAC_SECRET = SECRET;
});

/** Makes a token the way the signer does, from any body, with any secret: how a forger would try. */
function forge(body: unknown, secret: string): string {
  const text = Buffer.from(JSON.stringify(body), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(`findsprop.ai-chat.proposal.v1.${text}`)
    .digest()
    .toString("base64url");
  return `${text}.${signature}`;
}

/** The body of a token, read without checking anything. */
function bodyOf(token: string): Record<string, unknown> {
  const [body = ""] = token.split(".");
  return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
}

describe("UT-ai-proposal: a proposal the server signed", () => {
  it("is read back whole for the customer it was made for, enquiry and site visit alike", () => {
    for (const details of [ENQUIRY, VISIT]) {
      const { token } = signProposal(CUSTOMER, details, NOW);
      const check = verifyProposal(token, CUSTOMER, NOW);
      expect(check).toEqual({
        status: "valid",
        proposal: {
          ...details,
          version: 1,
          id: expect.stringMatching(/^[0-9a-f-]{36}$/),
          userId: CUSTOMER,
          expiresAt: Math.floor(NOW.getTime() / 1000) + PROPOSAL_LIFETIME_SECONDS,
        },
      });
    }
  });

  it("says when it stops being good, thirty minutes on", () => {
    const { expiresAt } = signProposal(CUSTOMER, ENQUIRY, NOW);
    expect(expiresAt.toISOString()).toBe("2026-11-15T07:00:00.000Z");
  });

  it("is made fresh each time: the same words give a different proposal", () => {
    const first = signProposal(CUSTOMER, ENQUIRY, NOW).token;
    const second = signProposal(CUSTOMER, ENQUIRY, NOW).token;
    expect(first).not.toBe(second);
    expect(bodyOf(first).id).not.toBe(bodyOf(second).id);
  });

  it("carries the customer, the target and the words, and nothing that names a phone or an email", () => {
    const body = bodyOf(signProposal(CUSTOMER, ENQUIRY, NOW).token);
    expect(Object.keys(body).sort()).toEqual([
      "expiresAt",
      "homeId",
      "id",
      "kind",
      "message",
      "userId",
      "version",
    ]);
  });

  it("is refused when it is read just as it runs out, and good one second before", () => {
    const { token } = signProposal(CUSTOMER, ENQUIRY, NOW);
    const lastSecond = new Date(NOW.getTime() + (PROPOSAL_LIFETIME_SECONDS - 1) * 1000);
    const atExpiry = new Date(NOW.getTime() + PROPOSAL_LIFETIME_SECONDS * 1000);
    expect(verifyProposal(token, CUSTOMER, lastSecond).status).toBe("valid");
    expect(verifyProposal(token, CUSTOMER, atExpiry)).toEqual({
      status: "refused",
      reason: "expired",
    });
  });

  it("is refused for any other customer, though the signature is good", () => {
    const { token } = signProposal(CUSTOMER, ENQUIRY, NOW);
    expect(verifyProposal(token, OTHER_CUSTOMER, NOW)).toEqual({
      status: "refused",
      reason: "other_customer",
    });
    expect(verifyProposal(token, "", NOW)).toEqual({
      status: "refused",
      reason: "other_customer",
    });
  });
});

describe("UT-ai-proposal: a forged or altered proposal is refused", () => {
  it("refuses a body that was changed, whatever was changed, under the old signature", () => {
    const { token } = signProposal(CUSTOMER, ENQUIRY, NOW);
    const [body = "", signature = ""] = token.split(".");
    const original = bodyOf(token);
    const changes: Record<string, unknown>[] = [
      { ...original, message: "Please send me your phone number." },
      { ...original, homeId: "m4y8b3ce" },
      { ...original, userId: OTHER_CUSTOMER },
      { ...original, expiresAt: (original.expiresAt as number) + 86_400 },
      { ...original, kind: "site_visit", slug: "kadal-vista", visitDate: "2026-12-05" },
    ];
    for (const change of changes) {
      const changed = Buffer.from(JSON.stringify(change), "utf8").toString("base64url");
      expect(
        verifyProposal(`${changed}.${signature}`, CUSTOMER, NOW),
        JSON.stringify(change),
      ).toEqual({ status: "refused", reason: "signature" });
    }
    // One character of the body altered, then one of the signature.
    const flip = (text: string) =>
      `${text.slice(0, 5)}${text[5] === "A" ? "B" : "A"}${text.slice(6)}`;
    expect(verifyProposal(`${flip(body)}.${signature}`, CUSTOMER, NOW).status).toBe("refused");
    expect(verifyProposal(`${body}.${flip(signature)}`, CUSTOMER, NOW)).toEqual({
      status: "refused",
      reason: "signature",
    });
  });

  it("refuses a proposal signed with another secret, even with a perfect body", () => {
    const { token } = signProposal(CUSTOMER, ENQUIRY, NOW);
    const forged = forge(bodyOf(token), "another-made-up-secret-of-32-characters!");
    expect(verifyProposal(forged, CUSTOMER, NOW)).toEqual({
      status: "refused",
      reason: "signature",
    });
  });

  it("refuses a signature made over the body without the label (a visitor hash or any other use of the secret)", () => {
    const { token } = signProposal(CUSTOMER, ENQUIRY, NOW);
    const [body = ""] = token.split(".");
    const unlabelled = createHmac("sha256", SECRET).update(body).digest().toString("base64url");
    expect(verifyProposal(`${body}.${unlabelled}`, CUSTOMER, NOW)).toEqual({
      status: "refused",
      reason: "signature",
    });
  });

  it("refuses a made-up, cut or reshaped token without throwing", () => {
    const { token } = signProposal(CUSTOMER, ENQUIRY, NOW);
    const [body = "", signature = ""] = token.split(".");
    const cases: unknown[] = [
      undefined,
      null,
      42,
      {},
      ["a", "b"],
      "",
      ".",
      "abc",
      `${body}`,
      `${body}.`,
      `.${signature}`,
      `${body}.${signature}.${signature}`,
      `${body}.${signature.slice(0, -4)}`,
      `${body}.${signature}extra`,
      `${body}.${signature}=`,
      `${body} .${signature}`,
      `${body}+/.${signature}`,
      "not a token at all",
    ];
    for (const attempt of cases) {
      expect(verifyProposal(attempt, CUSTOMER, NOW), String(attempt)).toEqual({
        status: "refused",
        reason: expect.stringMatching(/^(malformed|signature)$/),
      });
    }
  });

  it("refuses a correctly signed body that is not a proposal: an extra field, an unknown kind, a bad target, a long message", () => {
    const good = bodyOf(signProposal(CUSTOMER, ENQUIRY, NOW).token);
    const bad: Record<string, unknown>[] = [
      { ...good, phone: "made-up-phone" },
      { ...good, kind: "payment" },
      { ...good, homeId: "not-a-home-id" },
      { ...good, version: 2 },
      { ...good, id: "not-a-uuid" },
      { ...good, userId: "" },
      { ...good, message: "" },
      { ...good, message: "x".repeat(PROPOSAL_MESSAGE_MAX_CHARACTERS + 1) },
      { ...good, expiresAt: "soon" },
      { ...good, expiresAt: 1.5 },
      { kind: "site_visit", slug: "kadal-vista", visitDate: "tomorrow", message: MESSAGE },
    ];
    for (const body of bad) {
      expect(verifyProposal(forge(body, SECRET), CUSTOMER, NOW), JSON.stringify(body)).toEqual({
        status: "refused",
        reason: "malformed",
      });
    }
    // A body that is not JSON at all, signed correctly.
    const text = Buffer.from("not json", "utf8").toString("base64url");
    const signature = createHmac("sha256", SECRET)
      .update(`findsprop.ai-chat.proposal.v1.${text}`)
      .digest()
      .toString("base64url");
    expect(verifyProposal(`${text}.${signature}`, CUSTOMER, NOW)).toEqual({
      status: "refused",
      reason: "malformed",
    });
  });
});

describe("UT-ai-proposal: without the secret", () => {
  it("signs nothing, and says why in the log without naming the secret", () => {
    settings.env.RATE_LIMIT_HMAC_SECRET = undefined;
    expect(() => signProposal(CUSTOMER, ENQUIRY, NOW)).toThrow("not configured");
    expect(error).toHaveBeenCalledExactlyOnceWith(
      "ai proposal could not be signed, the secret is not set",
    );
  });

  it("refuses every token, even one signed while the secret was set", () => {
    const { token } = signProposal(CUSTOMER, ENQUIRY, NOW);
    settings.env.RATE_LIMIT_HMAC_SECRET = undefined;
    expect(verifyProposal(token, CUSTOMER, NOW)).toEqual({
      status: "refused",
      reason: "signature",
    });
    expect(error).toHaveBeenCalledExactlyOnceWith(
      "ai proposal could not be checked, the secret is not set",
    );
  });
});
