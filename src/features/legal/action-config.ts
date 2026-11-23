import { tagsAfterSiteSettingsChange } from "@/lib/cache-tags";
import { legalInputSchema } from "./schemas";

/**
 * How the legal editor's save runs, kept apart from the "use server" file so a test can build it (ADR-151). Only a
 * super admin may call it, and each save is limited with the admin's other edits (`admin_edit`). No idempotency key:
 * a save replaces a page with the text given, so repeating it changes nothing more (a repeated publish would raise the
 * version, which is why the screen disables the button while it is pending). Every save refreshes the site content
 * tag. The database audits `site_settings` itself (`cms.changed`, which page and who, never its text).
 */
export const saveLegalConfig = {
  name: "saveLegal",
  input: legalInputSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
  invalidate: () => tagsAfterSiteSettingsChange(),
};
