import { randomInt, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEVELOPER_PROJECT_COLUMNS, RANKING_COLUMNS } from "@/features/home/columns";
import { PHOTO_COLUMNS, PROPERTY_COLUMNS } from "@/features/property/schemas";
import {
  PROJECT_COLUMNS,
  PROJECT_LIST_COLUMNS,
  TREND_COLUMNS,
  UNIT_COLUMNS,
} from "@/features/projects/schemas";
import { SITEMAP_HOME_COLUMNS, SITEMAP_PROJECT_COLUMNS } from "@/features/sitemap/columns";
import { topLevelKeys } from "../public-columns";
import { adminClient, visitorClient } from "./support/clients";
import {
  createBuilderRecord,
  grantRole,
  removeTestUser,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// S4-T13, IT-queries (FR-SYS-08, R-DB-06, ADR-017, DEC-35): the select strings of the public pages,
// run as a visitor against the real database. A visitor gets approved homes and live projects of
// active builders, exactly the columns the page asks for, and is refused any private column.
// The data is made up. Every row carries this run's tag, so nothing else in the database is touched.

const RUN = randomUUID().slice(0, 8);
const LOCALITY = "Zzprojection Locality";
const PRIVATE_ADDRESS = "12 Private Lane";
const PRIVATE_REASON = "Photos unclear";

/** Eight characters from the alphabet a home's short id uses (no 0, 1, i, l or o). */
function madeUpShortId(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: 8 }, () => alphabet.charAt(randomInt(alphabet.length))).join("");
}

/** A visitor's client without the typed table names, so a test can send any select string. */
function looseVisitor(): SupabaseClient {
  return visitorClient() as unknown as SupabaseClient;
}

/** Checks a read worked and returns its rows. */
function rowsOf<Row>(result: { data: Row[] | null; error: { code?: string } | null }): Row[] {
  expect(result.error).toBeNull();
  return result.data ?? [];
}

describe("IT-queries: what a visitor reads (S4-T13)", () => {
  let user: TestUser;
  const homeIds: Record<"approved" | "pending" | "rejected", string> = {
    approved: "",
    pending: "",
    rejected: "",
  };
  const projectIds: Record<"live" | "pending" | "unpublished" | "inactiveBuilder", string> = {
    live: "",
    pending: "",
    unpublished: "",
    inactiveBuilder: "",
  };
  let activeBuilderId = "";
  let inactiveBuilderId = "";
  const slugs = {
    live: `it-live-${RUN}`,
    pending: `it-pending-${RUN}`,
    unpublished: `it-unpublished-${RUN}`,
    inactiveBuilder: `it-inactive-${RUN}`,
  };

  async function addHome(
    status: "pending" | "rejected",
    label: string,
    withPhoto: boolean,
  ): Promise<string> {
    const admin = adminClient();
    const { data, error } = await admin
      .from("properties")
      .insert({
        owner_id: user.userId,
        // The types ask for both (the trigger only fills them when they are missing).
        short_id: madeUpShortId(),
        slug: `it-${label}-${RUN}`,
        status,
        ...(status === "rejected" ? { rejection_reason: PRIVATE_REASON } : {}),
        listing_type: "sale",
        property_type: "apartment",
        title: `IT ${label} ${RUN}`,
        description: "A made-up home for the projection tests.",
        price: 5_000_000,
        area_sqft: 900,
        locality: LOCALITY,
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600001",
        address: PRIVATE_ADDRESS,
        location: "SRID=4326;POINT(80.27074 13.08274)",
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create the ${label} home (${error.code})`);
    if (withPhoto) {
      const photo = await admin.from("listing_media").insert({
        listing_id: data.id,
        storage_path: `it-public/${RUN}/${label}.jpg`,
        mime: "image/jpeg",
        bytes: 1000,
        width: 800,
        height: 600,
      });
      if (photo.error)
        throw new Error(`Could not add a photo to the ${label} home (${photo.error.code})`);
    }
    return data.id;
  }

  async function addProject(
    slug: string,
    builderId: string,
    options: { moderation: "approved" | "pending"; published: boolean },
  ): Promise<string> {
    const { data, error } = await adminClient()
      .from("projects")
      .insert({
        slug,
        name: `IT project ${slug}`,
        builder_id: builderId,
        locality: LOCALITY,
        moderation: options.moderation,
        published: options.published,
        ...(options.moderation === "approved" ? { moderated_at: new Date().toISOString() } : {}),
        latitude: 13.082741,
        longitude: 80.270741,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create the project ${slug} (${error.code})`);
    return data.id;
  }

  beforeAll(async () => {
    user = await signInTestCustomer();
    const admin = adminClient();

    // Homes: the approved one gets its photo while it is still pending, because adding a photo to an
    // approved home sends it back to review (DEC-09).
    homeIds.pending = await addHome("pending", "pending", true);
    homeIds.rejected = await addHome("rejected", "rejected", false);
    homeIds.approved = await addHome("pending", "approved", true);
    const approved = await admin
      .from("properties")
      .update({ status: "approved" })
      .eq("id", homeIds.approved);
    if (approved.error) throw new Error(`Could not approve the home (${approved.error.code})`);

    // Builders and projects
    await grantRole(user.userId, "builder");
    activeBuilderId = await createBuilderRecord(user.userId, { active: true });
    const inactive = await admin
      .from("builders")
      .insert({
        email: `it-${RUN}@example.test`,
        name: `IT inactive builder ${RUN}`,
        active: false,
      })
      .select("id")
      .single();
    if (inactive.error)
      throw new Error(`Could not create the inactive builder (${inactive.error.code})`);
    inactiveBuilderId = inactive.data.id;

    projectIds.live = await addProject(slugs.live, activeBuilderId, {
      moderation: "approved",
      published: true,
    });
    projectIds.pending = await addProject(slugs.pending, activeBuilderId, {
      moderation: "pending",
      published: false,
    });
    projectIds.unpublished = await addProject(slugs.unpublished, activeBuilderId, {
      moderation: "approved",
      published: false,
    });
    projectIds.inactiveBuilder = await addProject(slugs.inactiveBuilder, inactiveBuilderId, {
      moderation: "approved",
      published: true,
    });
    for (const projectId of [projectIds.live, projectIds.pending]) {
      const unit = await admin
        .from("project_units")
        .insert({ project_id: projectId, unit_number: "A-101", bhk: 2, price: 7_500_000 });
      if (unit.error) throw new Error(`Could not add a unit (${unit.error.code})`);
      const trend = await admin
        .from("project_price_trends")
        .insert({ project_id: projectId, month: "2026-10-01", price_per_sqft: 8350 });
      if (trend.error) throw new Error(`Could not add a price trend (${trend.error.code})`);
    }
  });

  afterAll(async () => {
    const admin = adminClient();
    await admin.from("projects").delete().in("id", Object.values(projectIds).filter(Boolean));
    if (inactiveBuilderId) await admin.from("builders").delete().eq("id", inactiveBuilderId);
    await admin.from("properties").delete().in("id", Object.values(homeIds).filter(Boolean));
    await removeTestUser();
  });

  describe("homes", () => {
    it("shows the approved home only, with exactly the columns the page asks for", async () => {
      const rows = rowsOf(
        await visitorClient()
          .from("properties")
          .select(PROPERTY_COLUMNS)
          .ilike("title", `%${RUN}%`),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe(homeIds.approved);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(topLevelKeys(PROPERTY_COLUMNS));
    });

    it("shows the photos of the approved home only", async () => {
      const visible = rowsOf(
        await visitorClient()
          .from("listing_media")
          .select(PHOTO_COLUMNS)
          .eq("listing_id", homeIds.approved),
      );
      expect(visible).toHaveLength(1);
      expect(Object.keys(visible[0] ?? {}).sort()).toEqual(topLevelKeys(PHOTO_COLUMNS));
      const hidden = rowsOf(
        await visitorClient()
          .from("listing_media")
          .select(PHOTO_COLUMNS)
          .eq("listing_id", homeIds.pending),
      );
      expect(hidden).toEqual([]);
    });

    it.each(["owner_id", "address", "location", "rejection_reason", "moderated_by", "closed_at"])(
      "refuses a read that names %s",
      async (column) => {
        const result = await looseVisitor()
          .from("properties")
          .select(`${PROPERTY_COLUMNS}, ${column}`)
          .limit(1);
        expect(result.error?.code).toBe("42501");
        expect(result.data).toBeNull();
      },
    );

    it("refuses a read of every column", async () => {
      const result = await looseVisitor().from("properties").select("*").limit(1);
      expect(result.error?.code).toBe("42501");
    });

    it("gives the search the rounded point and none of the private columns (DEC-35)", async () => {
      const { data, error } = await visitorClient().rpc("search_properties", {
        p_locality: LOCALITY,
        p_limit: 50,
      });
      expect(error).toBeNull();
      const rows = data ?? [];
      expect(rows).toHaveLength(1);
      const row = rows[0] as Record<string, unknown>;
      expect(row.id).toBe(homeIds.approved);
      expect(row.latitude).toBeCloseTo(13.083, 6);
      expect(row.longitude).toBeCloseTo(80.271, 6);
      for (const column of ["owner_id", "address", "location", "status", "rejection_reason"]) {
        expect(Object.keys(row)).not.toContain(column);
      }
    });

    it("lists the approved home in the sitemap read and nothing else of this run", async () => {
      const rows = rowsOf(
        await visitorClient()
          .from("properties")
          .select(SITEMAP_HOME_COLUMNS)
          .ilike("slug", `%${RUN}%`),
      );
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(topLevelKeys(SITEMAP_HOME_COLUMNS));
    });
  });

  describe("projects", () => {
    it("lists the live project of an active builder only, with the developer's name and id", async () => {
      const rows = rowsOf(
        await visitorClient()
          .from("projects")
          .select(PROJECT_LIST_COLUMNS)
          .ilike("slug", `%${RUN}%`),
      );
      expect(rows.map((row) => row.slug)).toEqual([slugs.live]);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(topLevelKeys(PROJECT_LIST_COLUMNS));
      expect(Object.keys(rows[0]?.builders ?? {}).sort()).toEqual(["id", "name"]);
    });

    it("opens the live project with exactly the columns the page asks for", async () => {
      const rows = rowsOf(
        await visitorClient().from("projects").select(PROJECT_COLUMNS).eq("slug", slugs.live),
      );
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(topLevelKeys(PROJECT_COLUMNS));
    });

    it.each(["pending", "unpublished", "inactiveBuilder"] as const)(
      "does not open the %s project",
      async (which) => {
        const rows = rowsOf(
          await visitorClient().from("projects").select(PROJECT_COLUMNS).eq("slug", slugs[which]),
        );
        expect(rows).toEqual([]);
      },
    );

    it("keeps a project's exact coordinates (DEC-35)", async () => {
      const rows = rowsOf(
        await visitorClient().from("projects").select("latitude, longitude").eq("slug", slugs.live),
      );
      expect(rows).toEqual([{ latitude: 13.082741, longitude: 80.270741 }]);
    });

    it("shows the units and price trend of the live project only", async () => {
      const units = rowsOf(
        await visitorClient()
          .from("project_units")
          .select(UNIT_COLUMNS)
          .eq("project_id", projectIds.live),
      );
      expect(units).toHaveLength(1);
      expect(Object.keys(units[0] ?? {}).sort()).toEqual(topLevelKeys(UNIT_COLUMNS));
      const trends = rowsOf(
        await visitorClient()
          .from("project_price_trends")
          .select(TREND_COLUMNS)
          .eq("project_id", projectIds.live),
      );
      expect(trends).toHaveLength(1);
      expect(Object.keys(trends[0] ?? {}).sort()).toEqual(topLevelKeys(TREND_COLUMNS));
      for (const [table, columns] of [
        ["project_units", UNIT_COLUMNS],
        ["project_price_trends", TREND_COLUMNS],
      ] as const) {
        const hidden = rowsOf(
          await looseVisitor().from(table).select(columns).eq("project_id", projectIds.pending),
        );
        expect(hidden).toEqual([]);
      }
    });

    it.each(["moderation", "published", "rejection_reason", "moderated_by", "form_id"])(
      "refuses a read that names %s",
      async (column) => {
        const result = await looseVisitor()
          .from("projects")
          .select(`${PROJECT_COLUMNS}, ${column}`)
          .limit(1);
        expect(result.error?.code).toBe("42501");
      },
    );

    it("reads the homepage developer columns for the live project's builder", async () => {
      const ranking = rowsOf(
        await visitorClient().from("projects").select(RANKING_COLUMNS).eq("slug", slugs.live),
      );
      expect(ranking).toEqual([{ builder_id: activeBuilderId }]);
      const rows = rowsOf(
        await visitorClient()
          .from("projects")
          .select(DEVELOPER_PROJECT_COLUMNS)
          .eq("builder_id", activeBuilderId)
          .ilike("slug", `%${RUN}%`),
      );
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(topLevelKeys(DEVELOPER_PROJECT_COLUMNS));
    });

    it("lists the live project in the sitemap read", async () => {
      const rows = rowsOf(
        await visitorClient()
          .from("projects")
          .select(SITEMAP_PROJECT_COLUMNS)
          .ilike("slug", `%${RUN}%`),
      );
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(topLevelKeys(SITEMAP_PROJECT_COLUMNS));
    });
  });

  describe("builders", () => {
    it("shows an active builder's public profile and hides an inactive builder", async () => {
      const visible = rowsOf(
        await visitorClient()
          .from("builders")
          .select("id, name, logo_url, website, description")
          .eq("id", activeBuilderId),
      );
      expect(visible).toHaveLength(1);
      const hidden = rowsOf(
        await visitorClient().from("builders").select("id").eq("id", inactiveBuilderId),
      );
      expect(hidden).toEqual([]);
    });

    it.each(["email", "phone", "user_id", "contact_person", "active"])(
      "refuses a read that names %s",
      async (column) => {
        const result = await looseVisitor().from("builders").select(`id, ${column}`).limit(1);
        expect(result.error?.code).toBe("42501");
      },
    );
  });

  describe("functions", () => {
    it("refuses a visitor the lead, event, project-id and rate-limit functions", async () => {
      const visitor = visitorClient();
      const results = await Promise.all([
        visitor.rpc("public_project_id", { project_slug: slugs.live }),
        visitor.rpc("submit_project_lead", {
          p_slug: slugs.live,
          p_kind: "enquiry",
          p_name: "Test Visitor",
          p_phone: "919900000001",
          p_visitor_hash: "d".repeat(40),
        }),
        visitor.rpc("track_project_event", {
          p_slug: slugs.live,
          p_event_type: "view",
          p_visitor_hash: "d".repeat(40),
        }),
        visitor.rpc("rate_limit_hit", {
          limit_scope: "project_lead",
          limit_subject: "d".repeat(40),
          max_hits: 5,
          window_seconds: 3600,
        }),
      ]);
      for (const result of results) {
        expect(result.error?.code).toBe("42501");
        expect(result.data).toBeNull();
      }
    });
  });
});
