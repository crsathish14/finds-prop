import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTranslator } from "next-intl";
import messages from "@/i18n/messages/en.json";
import type { Translate } from "@/lib/format";
import type { SessionView } from "@/server/auth/session";

// UT-ai-confirm-card (ADR-128 D-ACTION, AI-P6-T02): the confirm card the endpoint streams is built from the signed
// proposal and the account, never from the model's words. Every customer, home and sentence here is made up.

const settings = vi.hoisted(() => ({
  env: { RATE_LIMIT_HMAC_SECRET: "a-made-up-secret-of-thirty-two-chars!" as string | undefined },
}));
const warn = vi.hoisted(() => vi.fn());
const failed = vi.hoisted(() => vi.fn());

vi.mock("@/server/env", () => ({ env: settings.env }));
vi.mock(import("@/server/logger"), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, logger: { ...actual.logger, warn, error: failed, info: vi.fn() } };
});
vi.mock("@/features/enquiries", () => ({ sendEnquiry: vi.fn(), getEnquiryContact: vi.fn() }));
vi.mock("@/features/projects", async () => {
  const { isProjectSlug } = await import("@/features/projects/address");
  return { isProjectSlug, getProject: vi.fn() };
});
vi.mock("@/features/property", () => ({ getProperty: vi.fn() }));

const { signProposal } = await import("../../tools/proposal");
const { buildConfirmCard, phoneForCard } = await import("../build-card");
import type { ConfirmCardDeps } from "../build-card";
import { confirmCardSchema } from "../confirm-card";

const NOW = new Date("2026-11-15T06:30:00.000Z");
const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_ID = "22222222-2222-4222-8222-222222222222";
const MESSAGE = "Is this home still available? I can visit this weekend.";
const translate = createTranslator({ locale: "en", messages }) as unknown as Translate;

const CUSTOMER: SessionView = {
  userId: CUSTOMER_ID,
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};

const HOME = { title: "3 BHK apartment", locality: "Velachery", rupees: 12_500_000 } as const;

function deps(overrides: Partial<ConfirmCardDeps> = {}): ConfirmCardDeps {
  return {
    translate,
    now: () => NOW,
    readHome: () => Promise.resolve({ ...HOME, listingType: "sale" as const }),
    readProject: () =>
      Promise.resolve({ name: "Kadal Vista", locality: "Adyar", developerName: "Kadal Homes" }),
    readContact: () => Promise.resolve({ name: "Priya Raman", phone: "919840012345" }),
    ...overrides,
  };
}

const enquiryToken = (userId = CUSTOMER_ID, signedAt = NOW) =>
  signProposal(userId, { kind: "enquiry", homeId: "k3x9a2bd", message: MESSAGE }, signedAt).token;
const visitToken = (userId = CUSTOMER_ID) =>
  signProposal(
    userId,
    { kind: "site_visit", slug: "kadal-vista", visitDate: "2026-12-05", message: MESSAGE },
    NOW,
  ).token;

const projectEnquiryToken = (userId = CUSTOMER_ID) =>
  signProposal(userId, { kind: "project_enquiry", slug: "kadal-vista", message: MESSAGE }, NOW)
    .token;

beforeEach(() => {
  vi.clearAllMocks();
  settings.env.RATE_LIMIT_HMAC_SECRET = "a-made-up-secret-of-thirty-two-chars!";
});

describe("UT-ai-confirm-card: a card for a customer who can send", () => {
  it("shows the real home, the account's name and phone in full, and the signed message, with the proposal to send back", async () => {
    const token = enquiryToken();
    const card = await buildConfirmCard({ state: "ready", proposal: token }, CUSTOMER, deps());
    expect(card).toEqual({
      state: "ready",
      kind: "enquiry",
      proposal: token,
      target: { title: "3 BHK apartment", meta: "Velachery · ₹1.25 Cr" },
      name: "Priya Raman",
      phone: "+91 98400 12345",
      message: MESSAGE,
    });
    expect(confirmCardSchema.safeParse(card).success).toBe(true);
  });

  it("shows a rent home with its monthly price", async () => {
    const card = await buildConfirmCard(
      { state: "ready", proposal: enquiryToken() },
      CUSTOMER,
      deps({
        readHome: () => Promise.resolve({ ...HOME, rupees: 25_000, listingType: "rent" as const }),
      }),
    );
    expect(card).toMatchObject({ target: { meta: expect.stringContaining("Velachery") } });
    expect(card?.target.meta).not.toBe("Velachery · ₹1.25 Cr");
  });

  it("shows a site visit with the day written for reading and the developer named", async () => {
    const card = await buildConfirmCard(
      { state: "ready", proposal: visitToken() },
      CUSTOMER,
      deps(),
    );
    expect(card).toMatchObject({
      state: "ready",
      kind: "visit",
      target: { title: "Kadal Vista", meta: "Adyar · Kadal Homes" },
      visitDate: "5 Dec 2026",
      builderName: "Kadal Homes",
      message: MESSAGE,
    });
  });

  it("shows a plain project enquiry as an enquiry card about a project, with no day and no developer line (ADR-176)", async () => {
    const token = projectEnquiryToken();
    const card = await buildConfirmCard({ state: "ready", proposal: token }, CUSTOMER, deps());
    expect(card).toEqual({
      state: "ready",
      kind: "enquiry",
      about: "project",
      proposal: token,
      target: { title: "Kadal Vista", meta: "Adyar · Kadal Homes" },
      name: "Priya Raman",
      phone: "+91 98400 12345",
      message: MESSAGE,
    });
    expect(confirmCardSchema.safeParse(card).success).toBe(true);
  });

  it("gives a visitor the sign-in prompt for a project enquiry, quoting the words and carrying no proposal", async () => {
    const card = await buildConfirmCard(
      { state: "sign_in_required", kind: "project_enquiry", slug: "kadal-vista", message: MESSAGE },
      null,
      deps(),
    );
    expect(card).toEqual({
      state: "signed_out",
      kind: "enquiry",
      about: "project",
      target: { title: "Kadal Vista", meta: "Adyar · Kadal Homes" },
      message: MESSAGE,
    });
  });

  it("writes a number that is not Indian as a plus and its digits", () => {
    expect(phoneForCard("919840012345")).toBe("+91 98400 12345");
    expect(phoneForCard("447700900123")).toBe("+447700900123");
  });
});

describe("UT-ai-confirm-card: the sign-in prompt instead of a Send button", () => {
  it("is what a visitor who is not signed in gets, quoting what was drafted, with no proposal", async () => {
    const card = await buildConfirmCard(
      { state: "sign_in_required", kind: "enquiry", homeId: "k3x9a2bd", message: MESSAGE },
      null,
      deps(),
    );
    expect(card).toEqual({
      state: "signed_out",
      kind: "enquiry",
      target: { title: "3 BHK apartment", meta: "Velachery · ₹1.25 Cr" },
      message: MESSAGE,
    });
    expect(JSON.stringify(card)).not.toContain("proposal");
  });

  it("carries the visit day and the developer for a site visit", async () => {
    const card = await buildConfirmCard(
      {
        state: "sign_in_required",
        kind: "site_visit",
        slug: "kadal-vista",
        visitDate: "2026-12-05",
        message: MESSAGE,
      },
      null,
      deps(),
    );
    expect(card).toMatchObject({
      state: "signed_out",
      kind: "visit",
      visitDate: "5 Dec 2026",
      builderName: "Kadal Homes",
    });
  });

  it("is what a customer without a verified phone gets: a proposal exists, but nothing can be sent (no failure at the click)", async () => {
    const readContact = vi.fn();
    const card = await buildConfirmCard(
      { state: "ready", proposal: enquiryToken() },
      { ...CUSTOMER, phoneVerified: false },
      deps({ readContact }),
    );
    expect(card).toMatchObject({ state: "signed_out", kind: "enquiry", message: MESSAGE });
    expect(JSON.stringify(card)).not.toContain("Priya");
    expect(readContact).not.toHaveBeenCalled();
  });

  it("is what a customer whose account holds no phone gets", async () => {
    const card = await buildConfirmCard(
      { state: "ready", proposal: visitToken() },
      CUSTOMER,
      deps({ readContact: () => Promise.resolve({ name: "Priya Raman", phone: "" }) }),
    );
    expect(card).toMatchObject({ state: "signed_out", kind: "visit" });
  });
});

describe("UT-ai-confirm-card: no card at all", () => {
  it("is made for nobody when the proposal is another customer's, forged, expired or there is no session", async () => {
    const real = enquiryToken();
    const [body = "", signature = ""] = real.split(".");
    const cases: [string, string, SessionView | null][] = [
      ["another customer's", enquiryToken(OTHER_ID), CUSTOMER],
      ["forged", `${body}x.${signature}`, CUSTOMER],
      ["expired", enquiryToken(CUSTOMER_ID, new Date("2026-11-15T05:00:00Z")), CUSTOMER],
      ["no session", real, null],
    ];
    for (const [, proposal, session] of cases) {
      expect(await buildConfirmCard({ state: "ready", proposal }, session, deps())).toBeNull();
    }
  });

  it("is not made for a home or project that is not open, and not when a read fails", async () => {
    expect(
      await buildConfirmCard(
        { state: "ready", proposal: enquiryToken() },
        CUSTOMER,
        deps({ readHome: () => Promise.resolve(null) }),
      ),
    ).toBeNull();
    expect(
      await buildConfirmCard(
        { state: "ready", proposal: visitToken() },
        CUSTOMER,
        deps({ readProject: () => Promise.resolve(null) }),
      ),
    ).toBeNull();
    expect(
      await buildConfirmCard(
        { state: "ready", proposal: enquiryToken() },
        CUSTOMER,
        deps({ readContact: () => Promise.reject(new Error("the account could not be read")) }),
      ),
    ).toBeNull();
    expect(failed).toHaveBeenCalledOnce();
  });

  it("logs the reason a proposal was refused and nothing it held", async () => {
    await buildConfirmCard({ state: "ready", proposal: enquiryToken(OTHER_ID) }, CUSTOMER, deps());
    expect(warn).toHaveBeenCalledExactlyOnceWith("ai confirm card refused a proposal", {
      reason: "other_customer",
    });
  });
});
