import type { Metadata } from "next";
import {
  ContactEmail,
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
import {
  MyListingsTab,
  countMyListings,
  getMyContactEmail,
  saveContactEmail,
} from "@/features/listings";
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
 * already sending them to sign in). A tab with nothing to count shows no number. The count of the owner's listings
 * outside the drafts comes back too: an owner who has homes is offered the email for enquiries (ADR-186).
 */
async function readTabCounts() {
  const session = await getSessionView();
  if (!session) return { counts: {}, homes: 0 };
  const [saved, listings, received, sent, translate] = await Promise.all([
    countSavedHomes(),
    countMyListings(),
    countReceivedEnquiries(),
    countSentEnquiries(session.userId),
    getTranslate(),
  ]);
  const counts = tabCountsFrom({ saved, listings, received, sent }, (count) =>
    translate("account.dashboard.counts.new", { count }),
  );
  return { counts, homes: listings };
}

/**
 * The customer's dashboard (S5-T04, FR-ACC-01). The address names the tab (`?tab=`); only that tab's
 * content is made: the saved homes, the owner's listings, the enquiries received and the enquiries sent
 * (each shows its empty state when it has nothing). The four tabs carry their numbers. The email prompt
 * shows for someone with no address, the reminder for someone whose link is not used yet, and nothing
 * when the address is confirmed or could not be read. An owner with homes also sees the card for the email
 * enquiries are mailed to: the prompt when there is none, the address with Change when there is one (ADR-186).
 */
export default async function DashboardPage({ searchParams }: PageProps) {
  const tab = parseTab((await searchParams)["tab"]);
  const [person, email, { counts, homes }] = await Promise.all([
    getDashboardPerson(),
    getEmailState(),
    readTabCounts(),
  ]);
  // Nobody signed in: the page gate in the layout is already sending them to sign in.
  if (!person) return null;
  // The email enquiries are mailed to (ADR-186) is only asked of an owner who has homes; it is private and is
  // read as the owner.
  const contactEmail = homes > 0 ? await getMyContactEmail() : null;

  return (
    <main id="main" className="flex-1 bg-canvas-sunken">
      <DashboardScreen
        name={person.name}
        active={tab}
        postHref="/post-property"
        counts={counts}
        emailPending={email.kind === "pending"}
        notice={
          <>
            {email.kind === "none" || email.kind === "pending" ? (
              <EmailPrompt state={email} send={addEmail} resend={resendEmailLink} />
            ) : null}
            {homes > 0 ? <ContactEmail email={contactEmail} save={saveContactEmail} /> : null}
          </>
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
