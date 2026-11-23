import type { SupabaseClient } from "@supabase/supabase-js";
import "server-only";
import { CONTENT_MODULES, getSiteSettings, type ContentModule } from "@/features/site";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { toModulesView, type ContentModulesView, type ModuleCounts } from "./view";

/**
 * Where each module keeps its items, and which status counts as published (ADR-143 section 3). A job is published
 * while it is open. The tables come with the three module tracks, so until then every count here is null.
 */
const MODULE_TABLES = {
  blog: { table: "blog_posts", published: "published" },
  faq: { table: "faqs", published: "published" },
  careers: { table: "job_postings", published: "open" },
} as const satisfies Record<ContentModule, { table: string; published: string }>;

/** Postgres "undefined_table" and PostgREST "table not in the schema cache": the table is not built yet. */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);

/**
 * One count: the rows of a module's table with a status that are not in the Trash. Null, never a failure, when the
 * table does not exist yet or the read fails (the cause is logged by its code only); a count is a nice-to-have next to
 * the switch, so it never stops the switch from showing.
 */
async function countRows(
  supabase: SupabaseClient,
  module: ContentModule,
  status: string,
): Promise<number | null> {
  const { count, error } = await supabase
    .from(MODULE_TABLES[module].table)
    .select("id", { count: "exact", head: true })
    .eq("status", status)
    .is("deleted_at", null);
  if (error) {
    if (!MISSING_TABLE_CODES.has(error.code)) {
      logger.error("a content module count could not be read", { module, errorCode: error.code });
    }
    return null;
  }
  return count;
}

/** Published and draft counts for every module. Reads as the signed-in admin, so the row policies apply. */
export async function readModuleCounts(
  supabase: SupabaseClient,
): Promise<Record<ContentModule, ModuleCounts>> {
  const counts: Record<ContentModule, ModuleCounts> = {
    blog: { published: null, drafts: null },
    faq: { published: null, drafts: null },
    careers: { published: null, drafts: null },
  };
  await Promise.all(
    CONTENT_MODULES.map(async (module) => {
      const [published, drafts] = await Promise.all([
        countRows(supabase, module, MODULE_TABLES[module].published),
        countRows(supabase, module, "draft"),
      ]);
      counts[module] = { published, drafts };
    }),
  );
  return counts;
}

/**
 * The Content modules card and the bar at the top of each module's admin page (ADR-143): the saved switches, from the
 * cached site content, and the counts of published and draft items. Never cached as a whole: the counts are the
 * signed-in admin's own read.
 */
export async function getContentModulesView(): Promise<ContentModulesView> {
  const [settings, supabase] = await Promise.all([getSiteSettings(), createServerSupabase()]);
  // The tables are not in the generated types until each module's migration lands, so this reads through an untyped client.
  return toModulesView(settings, await readModuleCounts(supabase as unknown as SupabaseClient));
}
