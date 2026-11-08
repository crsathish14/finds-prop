import type { Metadata } from "next";
import {
  DashboardScreen,
  EmailPrompt,
  TabEmpty,
  getDashboardPerson,
  getEmailState,
  parseTab,
  tabCountsFrom,
} from "@/features/account";
import { addEmail, resendEmailLink } from "@/features/auth";
import {
  MyEnquiriesTab,
  ReceivedEnquiriesTab,
  countReceivedEnquiries,
  countSentEnquiries,
} from "@/features/enquiries";
import { MyListingsTab, countMyListings } from "@/features/listings";
import { SavedTab, countSavedHomes } from "@/features/saved";
import { getTranslate } from "@/features/site";
import { getSessionView } from "@/server/auth/get-session-view";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The account layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("account.dashboard.metaTitle") };
}

/**
 * The numbers on the four tabs (S6-T03): four reads, made together, and none for a visitor (the page gate is
 * already sending them to sign in). A tab with nothing to count shows no number.
 */
async function readTabCounts() {
  const session = await getSessionView();
  if (!session) return {};
  const [saved, listings, received, sent, translate] = await Promise.all([
    countSavedHomes(),
    countMyListings(),
    countReceivedEnquiries(),
    countSentEnquiries(session.userId),
    getTranslate(),
  ]);
  return tabCountsFrom({ saved, listings, received, sent }, (count) =>
    translate("account.dashboard.counts.new", { count }),
  );
}

/**
 * The customer's dashboard (S5-T04, FR-ACC-01). The address names the tab (`?tab=`); only that tab's
 * content is made: the saved homes, the owner's listings, the enquiries received and the enquiries sent
 * (each shows its empty state when it has nothing). The four tabs carry their numbers. The email prompt
 * shows for someone with no address, the reminder for someone whose link is not used yet, and nothing
 * when the address is confirmed or could not be read.
 */
export default async function DashboardPage({ searchParams }: PageProps) {
  const tab = parseTab((await searchParams)["tab"]);
  const [person, email, counts] = await Promise.all([
    getDashboardPerson(),
    getEmailState(),
    readTabCounts(),
  ]);
  // Nobody signed in: the page gate in the layout is already sending them to sign in.
  if (!person) return null;

  return (
    <main id="main" className="flex-1">
      <DashboardScreen
        name={person.name}
        active={tab}
        postHref="/post-property"
        counts={counts}
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
        ) : tab === "listings" ? (
          <MyListingsTab
            fallback={<TabEmpty tab={tab} browseHref="/properties" postHref="/post-property" />}
          />
        ) : tab === "received" ? (
          <ReceivedEnquiriesTab
            fallback={<TabEmpty tab={tab} browseHref="/properties" postHref="/post-property" />}
          />
        ) : (
          <MyEnquiriesTab
            fallback={<TabEmpty tab={tab} browseHref="/properties" postHref="/post-property" />}
          />
        )}
      </DashboardScreen>
    </main>
  );
}
