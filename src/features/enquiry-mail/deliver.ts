import type { Logger } from "@/server/logger";
import {
  DEFAULT_MAIL_TEMPLATES,
  renderMailTemplate,
  type MailSender,
  type MailTemplate,
  type MailTemplateKind,
  type MailTemplateValues,
} from "@/server/mail";
import { ActionError, classifyError } from "@/server/actions/normalise-error";
import type { EnquiryMailFacts } from "./types";

/**
 * Writing and sending the two mails of an enquiry (ADR-188). Everything it touches comes in through `deps`, so a
 * test can use a fake sender and a fake cap; the real ones are made in `deps.ts`.
 */
export interface EnquiryMailDeps {
  sender: MailSender;
  /** The published wording of both mails, or the wording in code. */
  getTemplates(): Promise<Record<MailTemplateKind, MailTemplate>>;
  /** Counts one notification against the poster's daily cap. True when it is within the cap. */
  withinCap(posterId: string): Promise<boolean>;
  /** The site's name, for `{siteName}`. */
  siteName: string;
  /** A path on this site as a whole address, for `{propertyLink}` and `{dashboardLink}`. */
  absoluteUrl(path: string): string;
  log: Logger;
}

/**
 * Stands in for a home that has no title (the column is optional). Unapproved wording (ADR-188): it reads after
 * "about" in both default mails.
 */
export const UNTITLED_HOME = "a home";

/** What `deliverEnquiryMails` did, for a test or a caller that wants to know; nothing in the app depends on it. */
export type EnquiryMailOutcome =
  { sent: Array<"poster" | "sender"> } | { skipped: "no-address" | "cap" | "cap-unavailable" };

/**
 * What goes in a log line about a failure: its code, and, only for a provider failure, the words of the error, which
 * the sender writes to say the status and the provider's error name and never an address, a subject or a text
 * (ADR-181). Any other error might carry anything, so only its code is kept (R-BE-10).
 */
export function failureFields(error: unknown): { errorCode: string; detail?: string } {
  const errorCode = classifyError(error);
  return error instanceof ActionError && error.code === "UPSTREAM_FAILED"
    ? { errorCode, detail: error.message }
    : { errorCode };
}

/**
 * Sends the mail to the poster (when there is an address for them) and the confirmation to the enquirer (when they
 * typed an email), after one count against the poster's daily cap. Each mail stands alone: one that fails is logged
 * (the code only, never an address or a word of the text) and the other still goes. Never throws for a failed send.
 *
 * - Neither address known: nothing to do, nothing counted.
 * - Past the cap: neither mail goes (the cap protects the poster's mailbox and the daily allowance of the provider),
 *   and the line says so. The enquiry is already stored and shows on the dashboard.
 * - A saved template that cannot be used is replaced by the wording in code (`renderMailTemplate`); the line says so.
 */
export async function deliverEnquiryMails(
  facts: EnquiryMailFacts,
  deps: EnquiryMailDeps,
): Promise<EnquiryMailOutcome> {
  const { log } = deps;
  if (!facts.posterEmail && !facts.enquirerEmail) {
    log.info("enquiry mail skipped: no address to send to");
    return { skipped: "no-address" };
  }
  if (!facts.posterEmail) log.info("enquiry mail: the poster has no email on file");

  try {
    if (!(await deps.withinCap(facts.posterId))) {
      log.warn("enquiry mail skipped: the poster's daily cap is used up");
      return { skipped: "cap" };
    }
  } catch (error) {
    log.warn("enquiry mail skipped: the daily cap could not be counted", failureFields(error));
    return { skipped: "cap-unavailable" };
  }

  let templates: Record<MailTemplateKind, MailTemplate>;
  try {
    templates = await deps.getTemplates();
  } catch (error) {
    log.warn("enquiry mail: the wording could not be read, using the wording in code", {
      ...failureFields(error),
    });
    templates = { ...DEFAULT_MAIL_TEMPLATES };
  }

  const values: MailTemplateValues = {
    enquirerName: facts.enquirerName,
    propertyTitle: facts.title && facts.title.trim() !== "" ? facts.title : UNTITLED_HOME,
    propertyLink: deps.absoluteUrl(facts.pagePath),
    dashboardLink: deps.absoluteUrl(facts.dashboardPath),
    siteName: deps.siteName,
  };
  const mails = [
    { name: "poster", kind: "enquiry_poster", to: facts.posterEmail },
    { name: "sender", kind: "enquiry_sender", to: facts.enquirerEmail },
  ] as const;

  const sent: Array<"poster" | "sender"> = [];
  for (const mail of mails) {
    if (!mail.to) continue;
    try {
      const rendered = renderMailTemplate(mail.kind, templates[mail.kind], values);
      if (rendered.fellBack) {
        log.warn("enquiry mail: the saved wording could not be used, sent the wording in code", {
          mail: mail.name,
        });
      }
      await deps.sender.send({ to: mail.to, subject: rendered.subject, text: rendered.text });
      sent.push(mail.name);
      log.info("enquiry mail handed to the sender", { mail: mail.name });
    } catch (error) {
      log.warn("enquiry mail not sent", { mail: mail.name, ...failureFields(error) });
    }
  }
  return { sent };
}
