import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { PROPOSAL_LIFETIME_SECONDS, PROPOSAL_MESSAGE_MAX_CHARACTERS } from "@/config/ai";
import { isProjectSlug } from "@/features/projects";
import { isShortId } from "@/lib/short-id";
import { env } from "@/server/env";
import { logger } from "@/server/logger";

/**
 * A proposal: what a propose tool hands to the confirm card, signed by the server so the card cannot be forged
 * (ADR-128 sections 4.3 D-ACTION and 5.3). It is a short token, `body.signature`, where the body is the facts
 * below and the signature is an HMAC-SHA256 of the body made with a server-only secret.
 *
 * What the signature holds, and why each part matters to the click that follows (P6-T02, which verifies it):
 * - the customer (`userId`), taken from the server-side session and never from the model or the browser, so a
 *   proposal made for one customer is refused for any other;
 * - the target and the words (`homeId` or `slug`, the visit day and the message), so nothing the card sends
 *   can differ from what the customer was shown;
 * - the time it stops being good (`expiresAt`), so an old card cannot be replayed;
 * - a fresh id, so two proposals for the same words are two proposals.
 * A token that was made up, cut, changed by one character, made for someone else, or has run out is refused.
 *
 * The secret is the one the rate limiter already holds (`RATE_LIMIT_HMAC_SECRET`, at least 32 characters). Every
 * signature is made over a fixed label first, so a token can never be mistaken for the visitor hash, which
 * uses the same secret for a different purpose. Without the secret nothing is signed and nothing verifies.
 *
 * Nothing here writes or sends anything: it only makes and checks tokens.
 */

/** The label every signature starts with: it keeps this use of the secret apart from every other. */
const SIGNATURE_LABEL = "findsprop.ai-chat.proposal.v1";
const SIGNATURE_BYTES = 32;
const BASE64_URL = /^[A-Za-z0-9_-]+$/;
/** The day of a site visit, `YYYY-MM-DD`. Whether it is a real day inside the window is the tool's check. */
const VISIT_DAY = /^\d{4}-\d{2}-\d{2}$/;

const messageSchema = z
  .string()
  .refine((text) => text.length > 0 && Array.from(text).length <= PROPOSAL_MESSAGE_MAX_CHARACTERS);

const sharedFields = {
  version: z.literal(1),
  /** One per proposal. P6-T02 may use it to name the card; it is not the idempotency key of the send. */
  id: z.uuid(),
  userId: z.string().min(1),
  /** Seconds since 1970 (UTC) after which the proposal is no longer good. */
  expiresAt: z.int().positive(),
  message: messageSchema,
};

const proposalSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...sharedFields,
    kind: z.literal("enquiry"),
    homeId: z.string().refine(isShortId),
  }),
  z.strictObject({
    ...sharedFields,
    kind: z.literal("project_enquiry"),
    slug: z.string().refine(isProjectSlug),
  }),
  z.strictObject({
    ...sharedFields,
    kind: z.literal("site_visit"),
    slug: z.string().refine(isProjectSlug),
    visitDate: z.string().regex(VISIT_DAY),
  }),
]);

/** A proposal as it is signed and as it is read back. */
export type Proposal = z.infer<typeof proposalSchema>;

/** What the tool decided; the signer adds the customer, the id and the time. */
export type ProposalDetails =
  | { readonly kind: "enquiry"; readonly homeId: string; readonly message: string }
  | { readonly kind: "project_enquiry"; readonly slug: string; readonly message: string }
  | {
      readonly kind: "site_visit";
      readonly slug: string;
      readonly visitDate: string;
      readonly message: string;
    };

/** Why a token was refused. Only for the logs and the tests: a caller shows the customer one fixed notice. */
export type ProposalRefusal = "malformed" | "signature" | "expired" | "other_customer";

export type ProposalCheck =
  | { readonly status: "valid"; readonly proposal: Proposal }
  | { readonly status: "refused"; readonly reason: ProposalRefusal };

function signatureOf(body: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${SIGNATURE_LABEL}.${body}`).digest();
}

/** Writes bytes as base64url. Reading back and writing again must give the same text (see `decode`). */
function encode(bytes: Buffer): string {
  return bytes.toString("base64url");
}

/** The bytes of a base64url text, or null when the text is not exactly what `encode` writes. */
function decode(text: string): Buffer | null {
  if (!BASE64_URL.test(text)) return null;
  const bytes = Buffer.from(text, "base64url");
  return encode(bytes) === text ? bytes : null;
}

/**
 * Signs a proposal for this customer. `userId` is the signed-in customer from the server-side session. Throws when
 * the secret is not set: a proposal that cannot be signed is not made (the caller turns the throw into
 * `unavailable`).
 */
export function signProposal(
  userId: string,
  details: ProposalDetails,
  now: Date = new Date(),
): { readonly token: string; readonly expiresAt: Date } {
  const secret = env.RATE_LIMIT_HMAC_SECRET;
  if (secret === undefined) {
    logger.error("ai proposal could not be signed, the secret is not set");
    throw new Error("RATE_LIMIT_HMAC_SECRET is not configured");
  }
  const expiresAt = Math.floor(now.getTime() / 1000) + PROPOSAL_LIFETIME_SECONDS;
  const proposal: Proposal = { version: 1, id: randomUUID(), userId, expiresAt, ...details };
  const body = encode(Buffer.from(JSON.stringify(proposal), "utf8"));
  return {
    token: `${body}.${encode(signatureOf(body, secret))}`,
    expiresAt: new Date(expiresAt * 1000),
  };
}

/**
 * Checks a token the card sends back. `userId` is the signed-in customer of THIS request, from the session, never
 * from the token or the browser. In order: the shape, the signature (compared in constant time), what the body
 * holds, the time, and that the customer is the one it was made for. Never throws; anything doubtful is refused.
 */
export function verifyProposal(
  token: unknown,
  userId: string,
  now: Date = new Date(),
): ProposalCheck {
  const secret = env.RATE_LIMIT_HMAC_SECRET;
  if (secret === undefined) {
    logger.error("ai proposal could not be checked, the secret is not set");
    return { status: "refused", reason: "signature" };
  }
  if (typeof token !== "string") return { status: "refused", reason: "malformed" };
  const parts = token.split(".");
  const [body, signature] = parts;
  if (parts.length !== 2 || body === undefined || signature === undefined) {
    return { status: "refused", reason: "malformed" };
  }
  const given = decode(signature);
  if (given === null || given.length !== SIGNATURE_BYTES || decode(body) === null) {
    return { status: "refused", reason: "malformed" };
  }
  if (!timingSafeEqual(given, signatureOf(body, secret))) {
    return { status: "refused", reason: "signature" };
  }
  let parsed: z.ZodSafeParseResult<Proposal>;
  try {
    const bytes = decode(body);
    parsed = proposalSchema.safeParse(JSON.parse(bytes?.toString("utf8") ?? ""));
  } catch {
    return { status: "refused", reason: "malformed" };
  }
  if (!parsed.success) return { status: "refused", reason: "malformed" };
  const proposal = parsed.data;
  if (proposal.expiresAt * 1000 <= now.getTime()) return { status: "refused", reason: "expired" };
  if (proposal.userId !== userId) return { status: "refused", reason: "other_customer" };
  return { status: "valid", proposal };
}
