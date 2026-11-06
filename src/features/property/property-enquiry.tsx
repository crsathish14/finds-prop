import { EnquiryCard } from "@/components/domain/enquiry-card";
import { ConnectedEnquiryCard } from "./connected-enquiry-card.client";
import type { EnquiryConnection } from "./use-enquiry-form.client";

type EnquirySource = {
  signedIn: boolean;
  /** Sign in, asking to come back to this home and to be told why (`/auth?gate=enquire`). */
  signInHref: string;
  createAccountHref: string;
  /** For a signed-in visitor: how the form sends. Without it the form is drawn and sends nothing. */
  connection?: EnquiryConnection | undefined;
};

/**
 * The enquiry card beside the details (from 1024 px): the gate for a visitor who is not signed in, the
 * form for one who is, connected to the enquiry action (S5-T03).
 */
export function PropertyEnquiryCard({
  signedIn,
  signInHref,
  createAccountHref,
  connection,
}: EnquirySource) {
  if (!signedIn) {
    return (
      <EnquiryCard
        state="signed_out"
        signInHref={signInHref}
        createAccountHref={createAccountHref}
      />
    );
  }
  return connection ? (
    <ConnectedEnquiryCard connection={connection} />
  ) : (
    <EnquiryCard state="form" />
  );
}

export type { EnquirySource };
