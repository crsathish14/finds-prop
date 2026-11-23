import { tagsAfterSiteSettingsChange } from "@/lib/cache-tags";
import { mailTemplateInputSchema } from "./schemas";

/**
 * How the mail editor's save runs, kept apart from the "use server" file so a test can build it (ADR-183). Only a
 * super admin may call it, and each save is limited with the admin's other edits (`admin_edit`). No idempotency key:
 * a save replaces a mail's wording with the text given, so repeating it changes nothing more. Every save refreshes the
 * site content tag, which the published wording is cached under. The database audits `site_settings` itself
 * (`cms.changed`: which setting and who, never its text).
 */
export const saveMailTemplateConfig = {
  name: "saveMailTemplate",
  input: mailTemplateInputSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: () => tagsAfterSiteSettingsChange(),
};
