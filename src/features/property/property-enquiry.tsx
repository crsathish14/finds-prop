import { useTranslations } from "next-intl";
import { EnquiryCard } from "@/components/domain/enquiry-card";

type EnquirySource = {
  signedIn: boolean;
  /** Sign in, asking to come back to this home and to be told why (`/auth?gate=enquire`). */
  signInHref: string;
  createAccountHref: string;
};

/**
 * The enquiry card beside the details (from 1024 px): the gate for a visitor who is not signed in, the
 * form for one who is. Sending enquiries is Stage 5 (S5-T03), so until then the form is the real one
 * with Send switched off and a line that says so, rather than a button that does nothing.
 */
export function PropertyEnquiryCard({ signedIn, signInHref, createAccountHref }: EnquirySource) {
  const translate = useTranslations("property.page.enquiry");
  if (!signedIn) {
    return (
      <EnquiryCard
        state="signed_out"
        signInHref={signInHref}
        createAccountHref={createAccountHref}
      />
    );
  }
  return <EnquiryCard state="form" sendDisabled sendNotice={translate("notOpen")} />;
}

export type { EnquirySource };
