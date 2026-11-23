import "server-only";
import { getEnquiryContact, sendEnquiry } from "@/features/enquiries";
import { getProject, submitProjectLead, visitDateProblem } from "@/features/projects";
import { getProperty } from "@/features/property";
import { ActionError } from "@/server/actions/normalise-error";
import { logger } from "@/server/logger";
import type { ActionResult } from "@/types/action";
import { verifyProposal } from "../tools/proposal";

/**
 * What the confirm card's Send button does on the server (AI-P6-T02, ADR-128 D-ACTION). It is a gate in front of
 * the two existing write paths and writes nothing itself: once the proposal has been checked, the send is the
 * existing `sendEnquiry` or `submitProjectLead` action, run as the signed-in customer, so their own rules apply
 * unchanged (a verified phone, the per-day and per-hour limits, one enquiry per home in 24 hours, the owner may not
 * enquire about their own home, the visit day window, and the database function's own checks).
 *
 * In this order, and nothing is sent unless every step passes:
 * 1. `verifyProposal(token, userId)` for the customer of THIS request (from the session, never the browser): a
 *    forged, altered, expired, malformed or other customer's proposal is `NOT_FOUND`, the same answer for all;
 * 2. the target is read again (the proposal may be half an hour old and the page reads are cached for minutes): a
 *    home or project that is no longer open is `NOT_FOUND`; for a site visit the day is checked again with
 *    `visitDateProblem` (a day signed late in the evening may be out of range by the click);
 * 3. the customer's name and verified phone are read from the account: nothing a card, the browser or the model
 *    sent is used for who is sending;
 * 4. the send, keyed by the PROPOSAL's own id. The same signed proposal verifies until it expires, so the key is
 *    what makes it send once: a second click, a second tab or a replay of the token finds the first result and
 *    creates no second enquiry or lead, whatever key the card made. The card's key (the action's own claim) also
 *    stops a double click from running steps 1 to 3 twice.
 * A message the forms would refuse (the forms count UTF-16 units, the tool counted characters) is refused by the
 * action's own schema with the normal validation error.
 */

export interface SendDeps {
  now(): Date;
  /** Whether the home is open now, by the page's own cached read. */
  homeIsOpen(homeId: string): Promise<boolean>;
  projectIsOpen(slug: string): Promise<boolean>;
  readContact(userId: string): Promise<{ name: string; phone: string }>;
  sendEnquiry(input: {
    shortId: string;
    name: string;
    phone: string;
    message: string;
    idempotencyKey: string;
  }): Promise<ActionResult<{ received: true }>>;
  submitProjectLead(input: {
    slug: string;
    kind: "enquiry" | "site_visit";
    name: string;
    visitDate?: string;
    message: string;
    idempotencyKey: string;
  }): Promise<ActionResult<{ received: true }>>;
}

export const realSendDeps: SendDeps = {
  now: () => new Date(),
  homeIsOpen: async (homeId) => (await getProperty(homeId)).status === "found",
  projectIsOpen: async (slug) => (await getProject(slug)).status === "found",
  readContact: async (userId) => {
    const { name, phone } = await getEnquiryContact(userId);
    return { name, phone };
  },
  sendEnquiry,
  submitProjectLead,
};

/** Gives an action's own failure back as the same failure (the code, the field messages, the wait), so nothing is lost or invented. */
function refuse(failure: Extract<ActionResult<unknown>, { ok: false }>): never {
  throw new ActionError(failure.code, "The send was refused", {
    ...(failure.fieldErrors ? { fieldErrors: failure.fieldErrors } : {}),
    ...(failure.retryAfter === undefined ? {} : { retryAfter: failure.retryAfter }),
    ...(failure.reason ? { reason: failure.reason } : {}),
  });
}

export async function sendConfirmedProposal(
  parameters: { proposal: string; userId: string },
  deps: SendDeps,
): Promise<{ received: true }> {
  const now = deps.now();
  const check = verifyProposal(parameters.proposal, parameters.userId, now);
  if (check.status !== "valid") {
    // Names only: never the token or what it held.
    logger.warn("ai confirm proposal refused", { reason: check.reason });
    throw new ActionError("NOT_FOUND", "The proposal is not valid");
  }
  const { proposal } = check;

  if (proposal.kind === "enquiry") {
    if (!(await deps.homeIsOpen(proposal.homeId))) {
      throw new ActionError("NOT_FOUND", "The home is not open for enquiries");
    }
  } else if (proposal.kind === "project_enquiry") {
    if (!(await deps.projectIsOpen(proposal.slug))) {
      throw new ActionError("NOT_FOUND", "The project is not open for requests");
    }
  } else {
    if (visitDateProblem(proposal.visitDate, now) !== null) {
      throw new ActionError("VALIDATION", "The visit day is outside the allowed days", {
        fieldErrors: { visitDate: [{ key: "validation.visitDateRange" }] },
      });
    }
    if (!(await deps.projectIsOpen(proposal.slug))) {
      throw new ActionError("NOT_FOUND", "The project is not open for requests");
    }
  }

  const contact = await deps.readContact(parameters.userId);
  if (!/^[0-9]{6,15}$/.test(contact.phone)) {
    throw new ActionError("FORBIDDEN", "A verified phone number is required.", {
      reason: "PHONE_NOT_VERIFIED",
    });
  }

  const result =
    proposal.kind === "enquiry"
      ? await deps.sendEnquiry({
          shortId: proposal.homeId,
          name: contact.name,
          phone: contact.phone,
          message: proposal.message,
          idempotencyKey: proposal.id,
        })
      : proposal.kind === "project_enquiry"
        ? await deps.submitProjectLead({
            slug: proposal.slug,
            kind: "enquiry",
            name: contact.name,
            message: proposal.message,
            idempotencyKey: proposal.id,
          })
        : await deps.submitProjectLead({
            slug: proposal.slug,
            kind: "site_visit",
            name: contact.name,
            visitDate: proposal.visitDate,
            message: proposal.message,
            idempotencyKey: proposal.id,
          });
  if (!result.ok) refuse(result);
  return { received: true };
}
