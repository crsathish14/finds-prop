import { unstable_rethrow } from "next/navigation";
import { getEnquiryContact, sendEnquiry } from "@/features/enquiries";
import { getSessionView } from "@/server/auth/get-session-view";
import { logger } from "@/server/logger";
import { MobileEnquiry } from "./mobile-enquiry.client";
import { PropertyEnquiryCard } from "./property-enquiry";
import type { EnquiryConnection } from "./use-enquiry-form.client";

/** Where "View my enquiries" leads: the dashboard's My enquiries tab. */
const ENQUIRIES_HREF = "/dashboard?tab=sent";

type Visitor = { signedIn: false } | { signedIn: true; connection: EnquiryConnection };

/**
 * Who is looking decides what the enquiry shows, so it is read here, in its own piece, and the page
 * puts each of these behind a Suspense boundary: the details and the photos are not held back by
 * the sign-in check (the card has a skeleton while it waits). The session is read once per request.
 * A visitor with no session, or an unreadable one, is not signed in: the gate is the safe answer. For a
 * signed-in visitor it also reads their own name, phone and verified email, so the form starts filled
 * in; a failure there gives an empty form, not the gate.
 */
async function readVisitor(shortId: string): Promise<Visitor> {
  let userId: string;
  try {
    const session = await getSessionView();
    if (session === null) return { signedIn: false };
    userId = session.userId;
  } catch (error) {
    // Next.js uses thrown signals for prerendering and redirects; they are not failures to read.
    unstable_rethrow(error);
    logger.error("the visitor's sign-in could not be read, the enquiry shows the gate", {});
    return { signedIn: false };
  }
  let prefill: EnquiryConnection["prefill"] = {};
  try {
    prefill = await getEnquiryContact(userId);
  } catch (error) {
    unstable_rethrow(error);
    logger.warn("the enquiry form could not be filled in from the account, it starts empty");
  }
  return {
    signedIn: true,
    connection: { shortId, send: sendEnquiry, prefill, enquiriesHref: ENQUIRIES_HREF },
  };
}

/** The card beside the details. */
export async function EnquiryPanel({
  shortId,
  signInHref,
  createAccountHref,
}: {
  shortId: string;
  signInHref: string;
  createAccountHref: string;
}) {
  const visitor = await readVisitor(shortId);
  return (
    <PropertyEnquiryCard
      signedIn={visitor.signedIn}
      signInHref={signInHref}
      createAccountHref={createAccountHref}
      connection={visitor.signedIn ? visitor.connection : undefined}
    />
  );
}

/** The bar and sheet of a phone. */
export async function MobileEnquirySlot({
  shortId,
  signInHref,
  createAccountHref,
  rupees,
  listingType,
  perSqftRupees,
}: {
  shortId: string;
  signInHref: string;
  createAccountHref: string;
  rupees: number;
  listingType: "sale" | "rent";
  perSqftRupees?: number | undefined;
}) {
  const visitor = await readVisitor(shortId);
  return (
    <MobileEnquiry
      signedIn={visitor.signedIn}
      signInHref={signInHref}
      createAccountHref={createAccountHref}
      connection={visitor.signedIn ? visitor.connection : undefined}
      rupees={rupees}
      listingType={listingType}
      perSqftRupees={perSqftRupees}
    />
  );
}
