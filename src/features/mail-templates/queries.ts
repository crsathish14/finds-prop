import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";
import {
  DEFAULT_MAIL_TEMPLATES,
  MAIL_TEMPLATE_KINDS,
  type MailTemplate,
  type MailTemplateKind,
} from "@/lib/mail-template";
import { logger } from "@/server/logger";
import { createPublicSupabase } from "@/server/supabase/public";
import { createServerSupabase } from "@/server/supabase/server";
import { MAIL_TEMPLATE_KEY_LIST, MAIL_TEMPLATE_SETTING_KEYS } from "./constants";
import { rowOf, sendingTemplate } from "./save-service";
import type { MailTemplateEditPage } from "./types";

interface SettingRow {
  key: string;
  value: unknown;
}

function valueOf(rows: readonly SettingRow[], kind: MailTemplateKind): unknown {
  return rows.find((row) => row.key === MAIL_TEMPLATE_SETTING_KEYS[kind])?.value ?? null;
}

/**
 * The wording the mail code sends with (ADR-183): the published version of each mail, or the wording in code when
 * there is none or the saved row does not match its rules, so a mail can always be written. Public data, so it uses
 * the cookie-less client and is cached under the site content tag, which every save refreshes. A read that fails
 * falls back to the wording in code and is logged with its error code only.
 */
export async function getMailTemplates(): Promise<Record<MailTemplateKind, MailTemplate>> {
  "use cache";
  cacheTag(CACHE_TAGS.siteSettings);
  cacheLife("minutes");

  const { data, error } = await createPublicSupabase()
    .from("site_settings")
    .select("key, value")
    .in("key", MAIL_TEMPLATE_KEY_LIST);
  if (error) {
    logger.error("the mail wording could not be read, using the wording in code", {
      errorCode: error.code,
    });
    return { ...DEFAULT_MAIL_TEMPLATES };
  }
  return {
    enquiry_poster: sendingTemplate(
      rowOf("enquiry_poster", valueOf(data, "enquiry_poster")),
      "enquiry_poster",
    ),
    enquiry_sender: sendingTemplate(
      rowOf("enquiry_sender", valueOf(data, "enquiry_sender")),
      "enquiry_sender",
    ),
  };
}

/**
 * The editor's starting point for both mails (ADR-183). Read as the signed-in admin and never cached: an editor must
 * open on what was last saved, not on a copy kept for minutes. A failed read throws, so the error page shows it.
 */
export async function getMailTemplatesEditPage(): Promise<
  Record<MailTemplateKind, MailTemplateEditPage>
> {
  const { data, error } = await (
    await createServerSupabase()
  )
    .from("site_settings")
    .select("key, value")
    .in("key", MAIL_TEMPLATE_KEY_LIST);
  if (error) throw new Error("The mail wording could not be read");
  const page = (kind: MailTemplateKind): MailTemplateEditPage => {
    const { published, working } = rowOf(kind, valueOf(data, kind));
    const stored = working ?? published;
    return {
      kind,
      template: stored
        ? { subject: stored.subject, body: stored.body }
        : DEFAULT_MAIL_TEMPLATES[kind],
      hasUnpublishedChanges: working !== undefined,
      published: published ? { updated: published.updated } : null,
    };
  };
  return Object.fromEntries(MAIL_TEMPLATE_KINDS.map((kind) => [kind, page(kind)])) as Record<
    MailTemplateKind,
    MailTemplateEditPage
  >;
}
