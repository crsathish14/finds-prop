import { z } from "zod";

/**
 * What the endpoint streams for the confirm card (ADR-128 section 4.3 D-ACTION, AI-P6-T02) and what the card's
 * button sends back. The card is built on the server from the signed proposal and the account, never from the
 * model's words: the target, the customer's name and verified phone, the message and the visit day are facts
 * the server read or took from the signed proposal. The page only draws them. One schema for the stream reader
 * and the action (R-FE-10).
 *
 * Two states: `ready` (the customer may press Send; it carries the proposal the click sends back) and `signed_out`
 * (nobody is signed in with a verified phone: the card is the sign-in prompt, and carries no proposal, because
 * nothing can be sent). The wording of every line is `en.json`; nothing here is a sentence.
 */

/** The longest signed proposal the card or the action takes: a 1,000-character message of four-byte characters, in base64, and its signature. */
const PROPOSAL_TOKEN_MAX_LENGTH = 8000;
/** The message as the card holds it: the same text the form counts in UTF-16 units, with room for characters outside the basic plane. */
const CARD_MESSAGE_MAX = 2000;

const targetSchema = z.object({
  title: z.string().max(300),
  /** One line under the title: the locality and price of a home, the locality and developer of a project. */
  meta: z.string().max(300),
});

const common = {
  kind: z.enum(["enquiry", "visit"]),
  target: targetSchema,
  message: z.string().min(1).max(CARD_MESSAGE_MAX),
  /** The visit day, already written for reading (a site visit only). */
  visitDate: z.string().max(60).optional(),
  /** The developer named in the consent sentence (a site visit only). */
  builderName: z.string().max(200).optional(),
};

export const confirmCardSchema = z.discriminatedUnion("state", [
  z.object({
    ...common,
    state: z.literal("ready"),
    /** The signed proposal the Send button sends back. Opaque to the page. */
    proposal: z.string().min(1).max(PROPOSAL_TOKEN_MAX_LENGTH),
    /** The customer's own name from the account, and the verified phone written in full. */
    name: z.string().max(200),
    phone: z.string().max(40),
  }),
  z.object({ ...common, state: z.literal("signed_out") }),
]);

export type ConfirmCard = z.infer<typeof confirmCardSchema>;

/** What the Send button sends: the proposal, and a fresh key made when the card appeared (one claim per card). */
export const confirmProposalInputSchema = z.object({
  proposal: z.string({ error: "validation.invalid" }).min(1).max(PROPOSAL_TOKEN_MAX_LENGTH),
  idempotencyKey: z.uuid({ error: "validation.invalid" }),
});

export type ConfirmProposalInput = z.infer<typeof confirmProposalInputSchema>;
