import {
  DEFAULT_MAIL_TEMPLATES,
  type MailTemplate,
  type MailTemplateKind,
} from "@/lib/mail-template";
import { ActionError } from "@/server/actions/normalise-error";
import { MAIL_TEMPLATE_SETTING_KEYS } from "./constants";
import {
  mailRowSchema,
  type MailRow,
  type MailTemplateInput,
  type StoredTemplate,
} from "./schemas";

/**
 * The rules of saving a mail's wording (ADR-183), apart from the code that reaches the database so they can be tested
 * with a stand-in. The real store is in `store.ts`: it acts as the signed-in admin, so the database's own policies
 * decide what is allowed (only the super admin may write `site_settings`; the audit trigger records which setting
 * changed, never its content). The action has already checked the caller is the super admin and counted the limit.
 */

export interface MailTemplateStore {
  /** The stored value of one mail's row, or null when there is none yet. */
  read(key: string): Promise<unknown>;
  /** Replaces one mail's row (adds it the first time). Throws the database's failure through `mapMailTemplateError`. */
  write(key: string, value: Record<string, unknown>): Promise<void>;
}

/** What was saved: enough for the screen to say what happened. */
export interface MailTemplateDone {
  kind: MailTemplateKind;
  published: boolean;
}

export interface MailTemplateFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/** Turns what the database raises into the closed set of action errors. */
export function mapMailTemplateError(failure: MailTemplateFailure): ActionError {
  const { code } = failure;
  if (code === "42501") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  if (code === "23514" || code === "22P02" || code === "23502") {
    return new ActionError("VALIDATION", "The mail wording is not valid");
  }
  return new ActionError("INTERNAL", "The mail wording could not be saved");
}

/** The day of a moment in India, as `YYYY-MM-DD`: the date the screen shows beside the live wording. */
export function dayInIndia(moment: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(moment);
}

/** What a row holds now; a row that does not match its shape counts as empty rather than blocking a save. */
export function rowOf(kind: MailTemplateKind, stored: unknown): MailRow {
  const parsed = mailRowSchema(kind).safeParse(stored);
  return parsed.success ? parsed.data : {};
}

/** The wording to send for a mail: the published version, or the wording in code when there is none. */
export function sendingTemplate(row: MailRow, kind: MailTemplateKind): MailTemplate {
  const { published } = row;
  return published
    ? { subject: published.subject, body: published.body }
    : DEFAULT_MAIL_TEMPLATES[kind];
}

/**
 * Saves a mail's wording. A working copy is kept beside the published version, so editing live wording never changes
 * what is sent until it is published. Publishing makes the wording live with today's day in India and removes the
 * working copy.
 */
export async function saveMailTemplate(
  store: MailTemplateStore,
  input: MailTemplateInput,
  moment: Date = new Date(),
): Promise<MailTemplateDone> {
  const key = MAIL_TEMPLATE_SETTING_KEYS[input.kind];
  const row = rowOf(input.kind, await store.read(key));

  if (input.publish) {
    const published: StoredTemplate = {
      subject: input.subject,
      body: input.body,
      updated: dayInIndia(moment),
    };
    await store.write(key, { published });
    return { kind: input.kind, published: true };
  }

  const working: StoredTemplate = { subject: input.subject, body: input.body, updated: null };
  await store.write(key, row.published ? { published: row.published, working } : { working });
  return { kind: input.kind, published: false };
}
