import type { ReactNode } from "react";
import { getSessionView } from "@/server/auth/get-session-view";
import { setEnquiryStatus } from "./actions";
import { getReceivedEnquiries } from "./queries";
import { ReceivedBoard } from "./received.client";

/**
 * The Enquiries received tab of the dashboard (S6-T03, FR-ACC-04): the enquiries other people sent about the
 * owner's listings, newest first, with the buttons that move each one on. With none, the tab shows its empty
 * state (the fallback the page gives). It renders at request time, so the "ago" words are as of now.
 */
export async function ReceivedEnquiriesTab({ fallback }: { fallback: ReactNode }) {
  const session = await getSessionView();
  if (!session) return fallback;
  const { enquiries, now } = await getReceivedEnquiries();
  if (enquiries.length === 0) return fallback;
  return (
    <ReceivedBoard
      enquiries={enquiries}
      now={now}
      empty={fallback}
      actions={{ setStatus: setEnquiryStatus }}
    />
  );
}
