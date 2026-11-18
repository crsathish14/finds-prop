import "server-only";
import { notFound } from "next/navigation";
import { isContentModuleOn, type ContentModule } from "./modules";
import { getSiteSettings } from "./queries";

/**
 * Whether a content module is switched on, read from the cached site content (ADR-143). Every place that shows
 * Blog, FAQ or Careers asks here, so switching a module off in the admin dashboard hides it everywhere at once.
 */
export async function getContentModuleOn(module: ContentModule): Promise<boolean> {
  return isContentModuleOn(await getSiteSettings(), module);
}

/** For a public page of a module: answers the normal not-found page when the module is switched off. */
export async function requireContentModule(module: ContentModule): Promise<void> {
  if (!(await getContentModuleOn(module))) notFound();
}
