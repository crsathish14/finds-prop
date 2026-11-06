import type { Metadata } from "next";
import {
  DashboardScreen,
  EmailPrompt,
  TabEmpty,
  getDashboardPerson,
  getEmailState,
  parseTab,
} from "@/features/account";
import { addEmail, resendEmailLink } from "@/features/auth";
import { MyEnquiriesTab } from "@/features/enquiries";
import { SavedTab } from "@/features/saved";
import { getTranslate } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The account layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("account.dashboard.metaTitle") };
}

/**
 * The customer's dashboard (S5-T04, FR-ACC-01). The address names the tab (`?tab=`); only that tab's
 * content is made. The tab lists arrive with the tasks that fill them, so each tab shows its empty
 * state for now. The email prompt shows for someone with no address, the reminder for someone whose
 * link is not used yet, and nothing when the address is confirmed or could not be read.
 */
export default async function DashboardPage({ searchParams }: PageProps) {
  const tab = parseTab((await searchParams)["tab"]);
  const [person, email] = await Promise.all([getDashboardPerson(), getEmailState()]);
  // Nobody signed in: the page gate in the layout is already sending them to sign in.
  if (!person) return null;

  return (
    <main id="main" className="flex-1">
      <DashboardScreen
        name={person.name}
        active={tab}
        postHref="/post-property"
        emailPending={email.kind === "pending"}
        notice={
          email.kind === "none" || email.kind === "pending" ? (
            <EmailPrompt state={email} send={addEmail} resend={resendEmailLink} />
          ) : null
        }
      >
        {tab === "saved" ? (
          <SavedTab
            fallback={<TabEmpty tab={tab} browseHref="/properties" postHref="/post-property" />}
          />
        ) : tab === "sent" ? (
          <MyEnquiriesTab
            fallback={<TabEmpty tab={tab} browseHref="/properties" postHref="/post-property" />}
          />
        ) : (
          <TabEmpty tab={tab} browseHref="/properties" postHref="/post-property" />
        )}
      </DashboardScreen>
    </main>
  );
}
