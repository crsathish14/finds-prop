/**
 * The things an owner may one day be told by mail (DEC-27, S6-T07): an enquiry arrived about their listing, and
 * their listing was approved or not approved. The events say what happened, with ids only; the sender's name,
 * phone and message are read where the mail is made, never carried here. Nothing emits these yet: the hook
 * points are where an action will call `Notifier.notify` after its write succeeds, once mail is decided.
 */
export const NOTIFICATION_KINDS = [
  "enquiry.received",
  "listing.approved",
  "listing.rejected",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type NotificationEvent =
  | { kind: "enquiry.received"; enquiryId: string; listingId: string }
  | { kind: "listing.approved"; listingId: string; shortId: string }
  | { kind: "listing.rejected"; listingId: string; shortId: string };

/**
 * Where an event is handed over. A notifier never throws into the action that called it: telling someone is
 * never a reason for the thing they did to fail.
 */
export interface Notifier {
  notify(event: NotificationEvent): Promise<void>;
}

/** The notifier of v1: it does nothing. */
export const silentNotifier: Notifier = {
  notify: () => Promise.resolve(),
};
