import type { ReactNode } from "react";
import { getSessionView } from "@/server/auth/get-session-view";
import { EnquiryList } from "./enquiry-list";
import { getSentEnquiries } from "./queries";

/**
 * The My enquiries tab of the dashboard (S5-T03): the enquiries the visitor sent, newest first. With
 * none, the tab shows its empty state (the fallback the page gives). It renders at request time, so
 * the "sent … ago" words are as of now.
 */
export async function MyEnquiriesTab({ fallback }: { fallback: ReactNode }) {
  const session = await getSessionView();
  if (!session) return fallback;
  const { enquiries, now } = await getSentEnquiries(session.userId);
  if (enquiries.length === 0) return fallback;
  return <EnquiryList enquiries={enquiries} now={now} />;
}
