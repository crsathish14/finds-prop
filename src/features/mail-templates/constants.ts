import type { MailTemplateKind } from "@/lib/mail-template";

/**
 * The `site_settings` row that holds each editable mail (ADR-183). The key rule allows lower case words and
 * underscores. The rows are public to read, like every site setting, so they hold only the wording of the mail:
 * never an address, a name, a phone number or any enquiry text.
 */
export const MAIL_TEMPLATE_SETTING_KEYS = {
  enquiry_poster: "mail_enquiry_poster",
  enquiry_sender: "mail_enquiry_sender",
} as const satisfies Record<MailTemplateKind, string>;

/** Both keys, for the one read that fetches both rows. */
export const MAIL_TEMPLATE_KEY_LIST: string[] = Object.values(MAIL_TEMPLATE_SETTING_KEYS);
