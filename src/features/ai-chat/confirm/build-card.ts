import "server-only";
import { getEnquiryContact } from "@/features/enquiries";
import { getProject } from "@/features/projects";
import { getProperty } from "@/features/property";
import { formatDate, formatPrice, formatRent, type Translate } from "@/lib/format";
import type { SessionView } from "@/server/auth/session";
import { logger } from "@/server/logger";
import type { ProposalOffer } from "../tools/proposal-offer";
import { verifyProposal, type Proposal } from "../tools/proposal";
import type { ConfirmCard } from "./confirm-card";

/**
 * Builds the confirm card the endpoint streams after an answer (AI-P6-T02, ADR-128 D-ACTION). The card is made
 * from facts the server holds, never from what the model wrote:
 * - the target (title and a line under it) is read from the pages' own cached reads;
 * - the message, the visit day and the target's id are what the proposal's signature covers: the proposal is
 *   checked here with `verifyProposal(token, userId)` for the signed-in customer of this request, so a card is
 *   never drawn for a forged, changed, expired or another customer's proposal;
 * - the customer's name and phone come from their account, read on the server with the session's own client.
 * A customer who is not signed in with a verified phone, or whose account holds no phone, gets the sign-in
 * prompt instead of a Send button: there is nothing to send. The click re-checks everything (`send.ts`).
 *
 * It never throws: anything doubtful gives no card (`null`), and the answer's text stands alone.
 */

const TARGET_TEXT_MAX = 300;
const FIELD_SEPARATOR = " · ";

export interface ConfirmCardDeps {
  readonly translate: Translate;
  /** The home's public facts as the property page reads them, or null when it is not open. */
  readHome(homeId: string): Promise<{
    title: string;
    locality: string | null;
    rupees: number;
    listingType: "sale" | "rent";
  } | null>;
  /** The project's public facts as the project page reads them, or null when it is not open. */
  readProject(slug: string): Promise<{
    name: string;
    locality: string | null;
    developerName: string;
  } | null>;
  /** The signed-in customer's name and verified phone digits, read from the account. */
  readContact(userId: string): Promise<{ name: string; phone: string }>;
  now(): Date;
}

export function realConfirmCardDeps(translate: Translate): ConfirmCardDeps {
  return {
    translate,
    async readHome(homeId) {
      const result = await getProperty(homeId);
      if (result.status !== "found") return null;
      const { property } = result;
      return {
        title: property.title,
        locality: property.locality,
        rupees: property.price,
        listingType: property.listingType,
      };
    },
    async readProject(slug) {
      const result = await getProject(slug);
      if (result.status !== "found") return null;
      const { project } = result;
      return {
        name: project.name,
        locality: project.locality,
        developerName: project.developer.name,
      };
    },
    readContact: async (userId) => {
      const { name, phone } = await getEnquiryContact(userId);
      return { name, phone };
    },
    now: () => new Date(),
  };
}

/** The sign-in number written for reading, in full: `+91 98765 43210`. Other numbers are `+` and the digits. */
export function phoneForCard(digits: string): string {
  const indian = /^91([6-9][0-9]{4})([0-9]{5})$/.exec(digits);
  return indian ? `+91 ${indian[1]} ${indian[2]}` : `+${digits}`;
}

/** The visit day (`YYYY-MM-DD`) written for reading in India time, such as "14 Nov 2026". */
function visitDayText(visitDate: string): string {
  return formatDate("en", new Date(`${visitDate}T12:00:00+05:30`), "medium");
}

function clip(text: string): string {
  return text.length > TARGET_TEXT_MAX ? text.slice(0, TARGET_TEXT_MAX) : text;
}

/** What the card needs of a proposal or of a sign-in offer, once the target has been read. */
type Facts =
  | { kind: "enquiry"; homeId: string; message: string }
  | { kind: "project_enquiry"; slug: string; message: string }
  | { kind: "visit"; slug: string; message: string; visitDate: string };

function factsOfProposal(proposal: Proposal): Facts {
  if (proposal.kind === "enquiry") {
    return { kind: "enquiry", homeId: proposal.homeId, message: proposal.message };
  }
  if (proposal.kind === "project_enquiry") {
    return { kind: "project_enquiry", slug: proposal.slug, message: proposal.message };
  }
  return {
    kind: "visit",
    slug: proposal.slug,
    message: proposal.message,
    visitDate: proposal.visitDate,
  };
}

function factsOfOffer(offer: Extract<ProposalOffer, { state: "sign_in_required" }>): Facts {
  if (offer.kind === "enquiry") {
    return { kind: "enquiry", homeId: offer.homeId, message: offer.message };
  }
  if (offer.kind === "project_enquiry") {
    return { kind: "project_enquiry", slug: offer.slug, message: offer.message };
  }
  return { kind: "visit", slug: offer.slug, message: offer.message, visitDate: offer.visitDate };
}

/** The card's own kind, and what an enquiry is about: a project's enquiry is an enquiry card about a project. */
function cardKind(facts: Facts): { kind: "enquiry" | "visit"; about?: "project" } {
  if (facts.kind === "visit") return { kind: "visit" };
  return facts.kind === "project_enquiry"
    ? { kind: "enquiry", about: "project" }
    : { kind: "enquiry" };
}

async function targetOf(
  facts: Facts,
  deps: ConfirmCardDeps,
): Promise<{
  target: { title: string; meta: string };
  extra: { visitDate?: string; builderName?: string };
} | null> {
  if (facts.kind === "project_enquiry") {
    const project = await deps.readProject(facts.slug);
    if (project === null) return null;
    const meta = [project.locality, project.developerName].filter(
      (part) => part !== null && part !== "",
    );
    return {
      target: { title: clip(project.name), meta: clip(meta.join(FIELD_SEPARATOR)) },
      extra: {},
    };
  }
  if (facts.kind === "enquiry") {
    const home = await deps.readHome(facts.homeId);
    if (home === null) return null;
    const price =
      home.listingType === "rent"
        ? formatRent(deps.translate, "en", home.rupees)
        : formatPrice(deps.translate, "en", home.rupees);
    const meta = [home.locality, price].filter((part) => part !== null && part !== "");
    return {
      target: { title: clip(home.title), meta: clip(meta.join(FIELD_SEPARATOR)) },
      extra: {},
    };
  }
  const project = await deps.readProject(facts.slug);
  if (project === null) return null;
  const meta = [project.locality, project.developerName].filter(
    (part) => part !== null && part !== "",
  );
  return {
    target: { title: clip(project.name), meta: clip(meta.join(FIELD_SEPARATOR)) },
    extra: { visitDate: visitDayText(facts.visitDate), builderName: clip(project.developerName) },
  };
}

/**
 * The card for an offer, or null for none. `session` is the caller of this request, from the verified token: it
 * is who the proposal must have been made for.
 */
export async function buildConfirmCard(
  offer: ProposalOffer,
  session: SessionView | null,
  deps: ConfirmCardDeps,
): Promise<ConfirmCard | null> {
  try {
    if (offer.state === "sign_in_required") {
      // Nobody was signed in when the tool ran: the card is the sign-in prompt that quotes what was drafted.
      const facts = factsOfOffer(offer);
      const read = await targetOf(facts, deps);
      if (read === null) return null;
      return {
        state: "signed_out",
        ...cardKind(facts),
        target: read.target,
        message: facts.message,
        ...read.extra,
      };
    }

    // `ready`: a proposal exists, so somebody was signed in; it must still be this request's customer.
    if (session === null) return null;
    const check = verifyProposal(offer.proposal, session.userId, deps.now());
    if (check.status !== "valid") {
      logger.warn("ai confirm card refused a proposal", { reason: check.reason });
      return null;
    }
    const facts = factsOfProposal(check.proposal);
    const read = await targetOf(facts, deps);
    if (read === null) return null;
    const signedOut: ConfirmCard = {
      state: "signed_out",
      ...cardKind(facts),
      target: read.target,
      message: facts.message,
      ...read.extra,
    };
    // Signed in without a verified phone (a sign-in the phone code did not make): nothing can be sent.
    if (!session.phoneVerified) return signedOut;
    const contact = await deps.readContact(session.userId);
    if (!/^[0-9]{6,15}$/.test(contact.phone)) return signedOut;
    return {
      state: "ready",
      ...cardKind(facts),
      proposal: offer.proposal,
      target: read.target,
      name: contact.name,
      phone: phoneForCard(contact.phone),
      message: facts.message,
      ...read.extra,
    };
  } catch (error) {
    // A read that failed gives no card; the answer's text stands alone. Never what the customer wrote.
    logger.error("ai confirm card could not be built", { error });
    return null;
  }
}
