/**
 * The things an owner may be told by mail (DEC-27, S6-T07, ADR-181, ADR-188): an enquiry arrived about their home, a
 * lead arrived about their project, and (not decided yet) their listing was approved or not approved. The events say
 * what happened, with ids only; the sender's name, phone and message are read where the mail is made, never carried
 * here. The two enquiry events are emitted by the enquiry actions after the enquiry is stored (ADR-188); the two
 * listing events are hook points that nothing emits yet.
 */
export const NOTIFICATION_KINDS = [
  "enquiry.received",
  "project_lead.received",
  "listing.approved",
  "listing.rejected",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NotificationEvent =
  | { kind: "enquiry.received"; enquiryId: string }
  | { kind: "project_lead.received"; leadId: string }
  | { kind: "listing.approved"; listingId: string; shortId: string }
  | { kind: "listing.rejected"; listingId: string; shortId: string };

/**
 * Where an event is handed over. A notifier never throws into the action that called it: telling someone is
 * never a reason for the thing they did to fail.
 */
export interface Notifier {
  notify(event: NotificationEvent): Promise<void>;
}

/** A notifier that does nothing: what a caller uses when no mail is wanted. */
export const silentNotifier: Notifier = {
  notify: () => Promise.resolve(),
};
