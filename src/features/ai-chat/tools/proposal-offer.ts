import { z } from "zod";
import { isShortId } from "@/lib/short-id";

/**
 * What a propose tool's result asks the confirm card to be (AI-P6-T02), taken from the tool's own checked output,
 * never from the model's words. The endpoint turns it into the card (`confirm/build-card.ts`) after the answer:
 * - `ready`: the signed proposal. The card is built from the proposal (the target, the message and the visit day
 *   are what the server signed) and the signed-in customer's account;
 * - `sign_in_required`: nobody is signed in, so there is no proposal; the target and the words are kept so the
 *   card can be the sign-in prompt that quotes them.
 * One offer is kept per customer message: the last one the tools made.
 */

const OFFER_MESSAGE_MAX = 2000;
/** The shape of a project slug, the same the chat cards accept (the slug itself came from a tool result). */
const PROJECT_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const signInFields = { message: z.string().min(1).max(OFFER_MESSAGE_MAX) };

const proposalOfferSchema = z.union([
  z.object({ state: z.literal("ready"), proposal: z.string().min(1) }),
  z.object({
    state: z.literal("sign_in_required"),
    kind: z.literal("enquiry"),
    homeId: z.string().refine(isShortId),
    ...signInFields,
  }),
  z.object({
    state: z.literal("sign_in_required"),
    kind: z.literal("site_visit"),
    slug: z.string().min(2).max(80).regex(PROJECT_SLUG),
    visitDate: z.string().min(1),
    ...signInFields,
  }),
]);

export type ProposalOffer = z.infer<typeof proposalOfferSchema>;

/** A tool's checked output, as the two propose tools give it (only the fields the offer needs). */
const readyOutput = z.object({ status: z.literal("ready"), proposal: z.string().min(1) });
const enquirySignInOutput = z.object({
  status: z.literal("sign_in_required"),
  target: z.object({ homeId: z.string() }),
  untrustedText: z.object({ message: z.string() }),
});
const visitSignInOutput = z.object({
  status: z.literal("sign_in_required"),
  target: z.object({ slug: z.string() }),
  visitDate: z.string(),
  untrustedText: z.object({ message: z.string() }),
});

/**
 * The offer a propose tool's output makes, or null when it makes none (another tool, or an output that is not a
 * card: an error result never gets here). Only the two propose tools are read, by name.
 */
export function offerFromOutput(toolName: string, output: unknown): ProposalOffer | null {
  if (toolName !== "propose_enquiry" && toolName !== "propose_site_visit") return null;
  const ready = readyOutput.safeParse(output);
  if (ready.success) return { state: "ready", proposal: ready.data.proposal };
  if (toolName === "propose_enquiry") {
    const signIn = enquirySignInOutput.safeParse(output);
    if (!signIn.success) return null;
    const offer = proposalOfferSchema.safeParse({
      state: "sign_in_required",
      kind: "enquiry",
      homeId: signIn.data.target.homeId,
      message: signIn.data.untrustedText.message,
    });
    return offer.success ? offer.data : null;
  }
  const signIn = visitSignInOutput.safeParse(output);
  if (!signIn.success) return null;
  const offer = proposalOfferSchema.safeParse({
    state: "sign_in_required",
    kind: "site_visit",
    slug: signIn.data.target.slug,
    visitDate: signIn.data.visitDate,
    message: signIn.data.untrustedText.message,
  });
  return offer.success ? offer.data : null;
}
