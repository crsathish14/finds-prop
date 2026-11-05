import { unstable_rethrow } from "next/navigation";
import { getSessionView } from "@/server/auth/get-session-view";
import { logger } from "@/server/logger";
import { MobileEnquiry } from "./mobile-enquiry.client";
import { PropertyEnquiryCard } from "./property-enquiry";

/**
 * Who is looking decides what the enquiry shows, so it is read here, in its own piece, and the page
 * puts each of these behind a Suspense boundary: the details and the photos are not held back by
 * the sign-in check (the card has a skeleton while it waits). The session is read once per request.
 * A visitor with no session, or an unreadable one, is not signed in: the gate is the safe answer.
 */
async function isSignedIn(): Promise<boolean> {
  try {
    return (await getSessionView()) !== null;
  } catch (error) {
    // Next.js uses thrown signals for prerendering and redirects; they are not failures to read.
    unstable_rethrow(error);
    logger.error("the visitor's sign-in could not be read, the enquiry shows the gate", {});
    return false;
  }
}

/** The card beside the details. */
export async function EnquiryPanel({
  signInHref,
  createAccountHref,
}: {
  signInHref: string;
  createAccountHref: string;
}) {
  return (
    <PropertyEnquiryCard
      signedIn={await isSignedIn()}
      signInHref={signInHref}
      createAccountHref={createAccountHref}
    />
  );
}

/** The bar and sheet of a phone. */
export async function MobileEnquirySlot({
  signInHref,
  createAccountHref,
  rupees,
  listingType,
  perSqftRupees,
}: {
  signInHref: string;
  createAccountHref: string;
  rupees: number;
  listingType: "sale" | "rent";
  perSqftRupees?: number | undefined;
}) {
  return (
    <MobileEnquiry
      signedIn={await isSignedIn()}
      signInHref={signInHref}
      createAccountHref={createAccountHref}
      rupees={rupees}
      listingType={listingType}
      perSqftRupees={perSqftRupees}
    />
  );
}
