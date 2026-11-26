import "server-only";
import { z } from "zod";
import type { ProposalOffer } from "../tools/proposal-offer";
import type { REPLY_MESSAGE_KEYS, ReplyItem } from "../endpoint/replies";
import type { CardReference } from "../tools/types";

/**
 * Which homes and projects this answer offered an enquiry or a site visit for (ADR-206), so the requirements state
 * remembers them and neither the buttons nor the model offer the same one again. An offer is a confirm card (a
 * propose tool ran) or an Enquire / Site visit button.
 */

/** What a proposal names, read from the body of a proposal this server signed during this message. */
const proposalTargetSchema = z.union([
  z.object({ kind: z.literal("enquiry"), homeId: z.string().min(1).max(40) }),
  z.object({
    kind: z.enum(["project_enquiry", "site_visit"]),
    slug: z.string().min(1).max(160),
  }),
]);

/**
 * The record a confirm card is for, or null. The proposal was signed by this server in this message, so its body is
 * only read here, to remember the offer; whether it may be sent is checked, as always, when Send is pressed.
 */
export function offerKey(offer: ProposalOffer): string | null {
  if (offer.state === "sign_in_required") {
    return offer.kind === "enquiry" ? `home:${offer.homeId}` : `project:${offer.slug}`;
  }
  const [body] = offer.proposal.split(".");
  if (body === undefined || body === "") return null;
  try {
    const parsed = proposalTargetSchema.safeParse(
      JSON.parse(Buffer.from(body, "base64url").toString("utf8")),
    );
    if (!parsed.success) return null;
    return parsed.data.kind === "enquiry"
      ? `home:${parsed.data.homeId}`
      : `project:${parsed.data.slug}`;
  } catch {
    return null;
  }
}

/** The buttons that offer an enquiry or a site visit. */
const OFFER_BUTTONS = new Set<string>([
  "enquireHome",
  "enquireProject",
  "siteVisit",
] satisfies (keyof typeof REPLY_MESSAGE_KEYS)[]);

/** The records the Enquire and Site visit buttons of this answer are about (one home or one project). */
export function offeredByReplies(
  replies: readonly ReplyItem[],
  references: readonly CardReference[],
): string[] {
  if (!replies.some((reply) => OFFER_BUTTONS.has(reply.key))) return [];
  return references.map((reference) =>
    reference.kind === "home" ? `home:${reference.homeId}` : `project:${reference.slug}`,
  );
}
