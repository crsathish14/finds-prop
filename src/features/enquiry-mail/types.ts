import type { NotificationEvent } from "@/server/mail";

/**
 * What the mail needs to know about one stored enquiry or lead, read where the mail is made (ADR-188). Never carried
 * by the event, which holds an id only. The phone number and the enquiry text are not here on purpose: no mail uses
 * them, so nothing in this code can leak them.
 */
export interface EnquiryMailFacts {
  /**
   * Who the daily cap counts: the home's owner or the project's builder. An id, never an address. A fact that
   * cannot name a poster is not mailed.
   */
  posterId: string;
  /** Where the poster is mailed: the owner's private contact email, or the builder's email. Null when there is none. */
  posterEmail: string | null;
  /** The name the enquirer typed. */
  enquirerName: string;
  /** The email the enquirer typed, or null (the field is optional). */
  enquirerEmail: string | null;
  /** The home's title (a home may have none) or the project's name. */
  title: string | null;
  /** The public page of the home or project, as a path (`/properties/...`). */
  pagePath: string;
  /** Where the poster reads the enquiry: the dashboard tab or the builder's leads page, as a path. */
  dashboardPath: string;
}

/**
 * Finds the facts for an event, or null when the event is not one it handles or the enquiry cannot be found. Each
 * feature that stores enquiries supplies its own (the service-role read stays in that feature's service file).
 * Throws when the database cannot be read; the notifier logs that and goes on.
 */
export type EnquiryMailFinder = (event: NotificationEvent) => Promise<EnquiryMailFacts | null>;
