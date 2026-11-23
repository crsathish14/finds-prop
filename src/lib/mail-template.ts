/**
 * The wording of the mails the site sends about an enquiry, and how it is filled in (ADR-183). Pure: it reads no
 * database and sends nothing, so the admin screen can show a preview with it in the browser and the mail code can
 * render a real mail with the same function. Plain text only: a template is a subject line and a body, never markup.
 *
 * A template may hold words in curly brackets (placeholders). Only the names listed here are allowed, and each mail
 * allows its own subset. A saved template that breaks a rule is never used: the mail falls back to the wording in code.
 */

/** The mails whose wording the super admin edits. The name is also the end of the `site_settings` key. */
export const MAIL_TEMPLATE_KINDS = ["enquiry_poster", "enquiry_sender"] as const;
export type MailTemplateKind = (typeof MAIL_TEMPLATE_KINDS)[number];

/** Every placeholder a template may hold, in the order the screen lists them. */
export const MAIL_PLACEHOLDERS = [
  "enquirerName",
  "propertyTitle",
  "propertyLink",
  "dashboardLink",
  "siteName",
] as const;
export type MailPlaceholder = (typeof MAIL_PLACEHOLDERS)[number];

/** Which placeholders each mail allows. The dashboard link is for the poster only: the enquirer has no dashboard of theirs for it. */
export const MAIL_TEMPLATE_PLACEHOLDERS: Readonly<
  Record<MailTemplateKind, readonly MailPlaceholder[]>
> = {
  enquiry_poster: ["enquirerName", "propertyTitle", "propertyLink", "dashboardLink", "siteName"],
  enquiry_sender: ["enquirerName", "propertyTitle", "propertyLink", "siteName"],
};

/** The placeholders a mail must hold (in the subject or the body). The poster must be told who wrote. */
export const MAIL_TEMPLATE_REQUIRED: Readonly<
  Record<MailTemplateKind, readonly MailPlaceholder[]>
> = {
  enquiry_poster: ["enquirerName"],
  enquiry_sender: [],
};

export const MAIL_SUBJECT_MAX = 120;
export const MAIL_BODY_MAX = 2000;

export interface MailTemplate {
  subject: string;
  body: string;
}

/** What goes into the placeholders. The dashboard link is only for the poster's mail. */
export interface MailTemplateValues {
  enquirerName: string;
  propertyTitle: string;
  propertyLink: string;
  siteName: string;
  dashboardLink?: string | undefined;
}

/**
 * The wording used until the admin publishes their own, and whenever a saved template cannot be used. Neutral on
 * purpose: no phone number and no enquiry text, only a name, the title and links. Unapproved wording (ADR-183).
 */
export const DEFAULT_MAIL_TEMPLATES: Readonly<Record<MailTemplateKind, MailTemplate>> = {
  enquiry_poster: {
    subject: "You got an enquiry from {enquirerName}",
    body: [
      "Hello,",
      "",
      "Someone named {enquirerName} sent an enquiry about {propertyTitle} on {siteName}.",
      "",
      "Open your dashboard to see it:",
      "{dashboardLink}",
      "",
      "The page they asked about:",
      "{propertyLink}",
    ].join("\n"),
  },
  enquiry_sender: {
    subject: "We sent your enquiry about {propertyTitle}",
    body: [
      "Hello {enquirerName},",
      "",
      "We have passed your enquiry about {propertyTitle} on to the owner.",
      "",
      "You can look at it again here:",
      "{propertyLink}",
      "",
      "{siteName}",
    ].join("\n"),
  },
};

/** Made-up values for the admin's preview. They look like real ones but belong to nobody. */
export const MAIL_SAMPLE_VALUES: Readonly<Required<MailTemplateValues>> = {
  enquirerName: "Sample Name",
  propertyTitle: "2 BHK apartment in Sample Nagar",
  propertyLink: "https://findsprop.com/properties/sample-home",
  dashboardLink: "https://findsprop.com/dashboard/enquiries",
  siteName: "findsprop",
};

/** One thing wrong with a template: which box, and what. The screen turns the reason into words. */
export type MailTemplateProblemReason =
  "empty" | "tooLong" | "badCharacters" | "unknownPlaceholder" | "missingPlaceholder";
export interface MailTemplateProblem {
  field: keyof MailTemplate;
  reason: MailTemplateProblemReason;
}

const PLACEHOLDER = /\{([^{}]*)\}/g;

/** The words in curly brackets, in the order they appear (a word used twice is listed twice). */
export function placeholdersIn(text: string): string[] {
  return Array.from(text.matchAll(PLACEHOLDER), (match) => match[1] ?? "");
}

/** Whether the text holds a control, format or private-use character. A body may hold line breaks; a subject may not. */
function hasBadCharacters(text: string, allowLineBreaks: boolean): boolean {
  const checked = allowLineBreaks ? text.replace(/\r?\n/g, "") : text;
  return /\p{C}/u.test(checked);
}

/**
 * Every rule a template must keep, one problem per broken rule and box: not empty, within the length limits, plain
 * text only, no placeholder outside the mail's list, and every required placeholder present in the subject or body.
 * An empty list means the template can be saved and used.
 */
export function mailTemplateProblems(
  kind: MailTemplateKind,
  template: MailTemplate,
): MailTemplateProblem[] {
  const problems: MailTemplateProblem[] = [];
  const allowed: readonly string[] = MAIL_TEMPLATE_PLACEHOLDERS[kind];
  const boxes = [
    { field: "subject", text: template.subject, max: MAIL_SUBJECT_MAX, lineBreaks: false },
    { field: "body", text: template.body, max: MAIL_BODY_MAX, lineBreaks: true },
  ] as const;
  for (const { field, text, max, lineBreaks } of boxes) {
    if (text.trim() === "") problems.push({ field, reason: "empty" });
    else if (text.length > max) problems.push({ field, reason: "tooLong" });
    if (hasBadCharacters(text, lineBreaks)) problems.push({ field, reason: "badCharacters" });
    if (placeholdersIn(text).some((name) => !allowed.includes(name))) {
      problems.push({ field, reason: "unknownPlaceholder" });
    }
  }
  const used = new Set([...placeholdersIn(template.subject), ...placeholdersIn(template.body)]);
  if (MAIL_TEMPLATE_REQUIRED[kind].some((name) => !used.has(name))) {
    problems.push({ field: "body", reason: "missingPlaceholder" });
  }
  return problems;
}

/** A value for a placeholder, on one line: every control or format character and every run of white space becomes one space. */
export function cleanMailValue(value: string): string {
  return value.replace(/[\p{C}\s]+/gu, " ").trim();
}

export interface RenderedMail {
  subject: string;
  /** The plain text body. */
  text: string;
  /** True when the template given could not be used and the wording in code was used instead. */
  fellBack: boolean;
}

function fill(text: string, values: Readonly<Record<string, string>>): string {
  // One pass over the template, so a value that holds curly brackets is never filled in again.
  return text.replace(PLACEHOLDER, (_whole, name: string) => values[name] ?? "");
}

/**
 * Fills a template with the values and returns the subject and the plain text body. It sends nothing and reads
 * nothing. Values are cleaned first (`cleanMailValue`), so a name with a line break in it cannot start a new line in
 * the subject or add a header. A template that breaks any rule (an unknown placeholder, a missing required one, a
 * control character, a length) is not used: the wording in code is filled in instead and `fellBack` says so, so the
 * caller can log it without the text. A mail never goes out with a raw `{placeholder}` in it.
 */
export function renderMailTemplate(
  kind: MailTemplateKind,
  template: MailTemplate,
  values: MailTemplateValues,
): RenderedMail {
  const clean: Record<string, string> = {};
  for (const [name, value] of Object.entries(values)) clean[name] = cleanMailValue(value ?? "");
  const filled = (from: MailTemplate) => ({
    subject: fill(from.subject, clean).replace(/\s+/g, " ").trim(),
    text: fill(from.body, clean)
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim(),
  });

  if (mailTemplateProblems(kind, template).length === 0) {
    const mail = filled(template);
    // A template made only of values that came out empty would send a blank mail: use the wording in code instead.
    if (mail.subject !== "" && mail.text !== "") return { ...mail, fellBack: false };
  }
  return { ...filled(DEFAULT_MAIL_TEMPLATES[kind]), fellBack: true };
}
