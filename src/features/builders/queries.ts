import "server-only";
import { logger } from "@/server/logger";
import { createServerSupabase } from "@/server/supabase/server";
import { BUILDER_KINDS } from "./constants";
import { toBuilderRows, type BuilderRowView, type MyProfileView } from "./view";

/**
 * Every builder with their status, projects, leads and last sign-in, for the admin's Builders table (S7-T05,
 * FR-ADM-04). It is one call to `admin_builder_overview()`, made as the signed-in admin: the function checks that
 * itself and refuses anyone else, so the layout's gate is not the only thing standing between a customer and this
 * list. A failed read throws, so the portal's error page shows it. `now` is when the read was made, so the screen
 * can say "3 days ago" without reading the clock itself.
 */
export async function getBuilderOverview(): Promise<{ builders: BuilderRowView[]; now: number }> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.rpc("admin_builder_overview");
  if (error) {
    logger.error("the builders could not be read", { errorCode: error.code });
    throw error;
  }
  return { builders: toBuilderRows(data), now: Date.now() };
}

/**
 * The signed-in builder's own record and the number of their projects buyers can see, for the profile page (S7-T03,
 * FR-BLD-05). `my_builder()` answers only for the caller's own active record, so null means there is none. Both
 * reads are made as the builder.
 */
export async function getMyProfile(): Promise<MyProfileView | null> {
  const supabase = await createServerSupabase();
  const mine = await supabase
    .rpc("my_builder")
    .select("id, name, email, kind, contact_person, phone, logo_url, website, description");
  if (mine.error) {
    logger.error("the builder's profile could not be read", { errorCode: mine.error.code });
    throw mine.error;
  }
  const row = mine.data[0];
  if (!row) return null;
  const live = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("builder_id", row.id)
    .eq("moderation", "approved")
    .eq("published", true);
  if (live.error) {
    logger.error("the builder's project count could not be read", { errorCode: live.error.code });
    throw live.error;
  }
  const kind = BUILDER_KINDS.find((known) => known === row.kind) ?? "builder";
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    kind,
    contactPerson: row.contact_person,
    phone: row.phone,
    logoUrl: row.logo_url,
    website: row.website,
    description: row.description,
    liveProjects: live.count ?? 0,
  };
}
