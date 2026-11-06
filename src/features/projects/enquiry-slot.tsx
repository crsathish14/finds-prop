import { unstable_rethrow } from "next/navigation";
import { maskIndianMobile } from "@/lib/phone";
import { ActionError } from "@/server/actions/normalise-error";
import { logger } from "@/server/logger";
import { visitDateWindow } from "./lead-view";
import { ProjectLeadCard } from "./project-lead-card.client";
import { ProjectLeadPanel } from "./project-lead-panel.client";
import { verifiedPhoneDigits } from "./service";

/**
 * The account's verified phone, or null when the visitor is not signed in with a phone (or the token
 * cannot be read: the gate is the safe answer). Only the token is read, not the user's roles.
 */
async function accountPhone(): Promise<string | null> {
  try {
    return await verifiedPhoneDigits();
  } catch (error) {
    // Next.js uses thrown signals for prerendering and redirects; they are not failures to read.
    unstable_rethrow(error);
    // `verifiedPhoneDigits` refuses a visitor without a phone with FORBIDDEN: that is the normal gate.
    if (error instanceof ActionError && error.code === "FORBIDDEN") return null;
    logger.error("the visitor's phone could not be read, the enquiry shows the gate", {});
    return null;
  }
}

/**
 * The enquiry card beside a project's details. Who is looking decides what it shows, so it is read here,
 * in its own piece, and the page puts it behind a Suspense boundary: the details are not held back by
 * the sign-in check (the card has a skeleton while it waits). A visitor who is not signed in with a
 * phone sees the gate; one who is sees the form with the account's phone locked in.
 */
export async function ProjectEnquirySlot({
  slug,
  signInHref,
  createAccountHref,
}: {
  slug: string;
  signInHref: string;
  createAccountHref: string;
}) {
  const digits = await accountPhone();
  if (digits === null) {
    return (
      <ProjectLeadCard
        state="signed_out"
        signInHref={signInHref}
        createAccountHref={createAccountHref}
      />
    );
  }
  // The window is counted from the moment the page is made, after the session is read.
  const { min, max } = visitDateWindow(new Date());
  return (
    <ProjectLeadPanel
      slug={slug}
      phone={maskIndianMobile(`+${digits}`)}
      visitDateMin={min}
      visitDateMax={max}
    />
  );
}
