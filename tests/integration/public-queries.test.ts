import { randomInt, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEVELOPER_PROJECT_COLUMNS } from "@/features/home/columns";
import { PHOTO_COLUMNS, PROPERTY_COLUMNS } from "@/features/property/schemas";
import {
  PROJECT_COLUMNS,
  PROJECT_LIST_COLUMNS,
  TREND_COLUMNS,
  UNIT_COLUMNS,
} from "@/features/projects/schemas";
import { SITEMAP_HOME_COLUMNS } from "@/features/sitemap/columns";
import { topLevelKeys } from "../public-columns";
import { adminClient, visitorClient } from "./support/clients";
import {
  createBuilderRecord,
  grantRole,
  removeTestUser,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// S4-T13, IT-queries (FR-SYS-08, R-DB-06, ADR-017, DEC-35, ADR-171): what the public pages read, run as a visitor
// against the real database. A visitor who is not signed in gets one approved home or one live project of an active
// builder through the narrow functions, exactly the columns the page asks for, and is refused the tables and the
// lists (login wall); a signed-in person reads the lists and is refused any private column.
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

  /** The public id of a home, which the fixtures leave to the database's own choice of the home's row. */
  async function shortIdOf(homeId: string): Promise<string> {
    const { data, error } = await adminClient()
      .from("properties")
      .select("short_id")
      .eq("id", homeId)
      .single();
    if (error) throw new Error(`Could not read a short id (${error.code})`);
    return data.short_id;
  }

  /** The signed-in test customer's client without the typed table names, to send any select string. */
  function looseSignedIn(): SupabaseClient {
    return user.client as unknown as SupabaseClient;
  }

  type PropertyDocument = {
    property: Record<string, unknown>;
    photos: Record<string, unknown>[];
    label: unknown;
  };
  type ProjectDocument = {
    project: Record<string, unknown> & { builders: Record<string, unknown> };
    units: Record<string, unknown>[];
    unit_count: number;
    available_count: number;
    trend: Record<string, unknown>[];
  };

  describe("homes", () => {
    it("gives the approved home through public_property, with exactly the columns the page asks for", async () => {
      const { data, error } = await visitorClient().rpc("public_property", {
        p_short_id: await shortIdOf(homeIds.approved),
      });
      expect(error).toBeNull();
      const document = data as unknown as PropertyDocument;
      expect(document.property["id"]).toBe(homeIds.approved);
      expect(Object.keys(document.property).sort()).toEqual(topLevelKeys(PROPERTY_COLUMNS));
    });

    it("gives the photos of the approved home only", async () => {
      const { data } = await visitorClient().rpc("public_property", {
        p_short_id: await shortIdOf(homeIds.approved),
      });
      const document = data as unknown as PropertyDocument;
      expect(document.photos).toHaveLength(1);
      expect(Object.keys(document.photos[0] ?? {}).sort()).toEqual(topLevelKeys(PHOTO_COLUMNS));
    });

    it.each(["pending", "rejected"] as const)("gives nothing for the %s home", async (which) => {
      const { data, error } = await visitorClient().rpc("public_property", {
        p_short_id: await shortIdOf(homeIds[which]),
      });
      expect(error).toBeNull();
      expect(data).toBeNull();
    });

    it.each(["properties", "listing_media"] as const)(
      "refuses a visitor who is not signed in the %s table (login wall)",
      async (table) => {
        const result = await visitorClient().from(table).select("id").limit(1);
        expect(result.error?.code).toBe("42501");
        expect(result.data).toBeNull();
      },
    );

    it("refuses a visitor who is not signed in the search (login wall)", async () => {
      const result = await visitorClient().rpc("search_properties", { p_limit: 5 });
      expect(result.error?.code).toBe("42501");
    });

    it.each(["owner_id", "address", "location", "rejection_reason", "moderated_by", "closed_at"])(
      "refuses a signed-in person a read that names %s",
      async (column) => {
        const result = await looseSignedIn()
          .from("properties")
          .select(`${PROPERTY_COLUMNS}, ${column}`)
          .limit(1);
        expect(result.error?.code).toBe("42501");
        expect(result.data).toBeNull();
      },
    );

    it("refuses a signed-in person a read of every column", async () => {
      const result = await looseSignedIn().from("properties").select("*").limit(1);
      expect(result.error?.code).toBe("42501");
    });

    it("gives a signed-in person's search the rounded point and none of the private columns (DEC-35)", async () => {
      const { data, error } = await user.client.rpc("search_properties", {
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
      const { data, error } = await visitorClient().rpc("sitemap_entries", {
        p_kind: "homes",
        p_limit: 1000,
        p_offset: 0,
      });
      expect(error).toBeNull();
      const rows = (data ?? []).filter((row) => row.slug.includes(RUN));
      expect(rows).toHaveLength(1);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(topLevelKeys(SITEMAP_HOME_COLUMNS));
    });
  });

  describe("projects", () => {
    it("lists the live project of an active builder only, for a signed-in person, with the developer's name and id", async () => {
      const { data, error } = await user.client.rpc("live_project_list", { p_limit: 120 });
      expect(error).toBeNull();
      const rows = (data as unknown as (Record<string, unknown> & { slug: string })[]).filter(
        (row) => row.slug.includes(RUN),
      );
      expect(rows.map((row) => row.slug)).toEqual([slugs.live]);
      // The list function also gives the project's city (Plan 2), which the page does not ask for yet.
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(
        [...topLevelKeys(PROJECT_LIST_COLUMNS), "city"].sort(),
      );
      expect(Object.keys((rows[0]?.["builders"] as object) ?? {}).sort()).toEqual(["id", "name"]);
    });

    it("refuses the list to a visitor who is not signed in (login wall)", async () => {
      const result = await visitorClient().rpc("live_project_list", { p_limit: 5 });
      expect(result.error?.code).toBe("42501");
    });

    it.each(["projects", "project_units", "project_price_trends"] as const)(
      "refuses a visitor who is not signed in the %s table (login wall)",
      async (table) => {
        const result = await visitorClient().from(table).select("id").limit(1);
        expect(result.error?.code).toBe("42501");
        expect(result.data).toBeNull();
      },
    );

    it("opens the live project through public_project with exactly the columns the page asks for", async () => {
      const { data, error } = await visitorClient().rpc("public_project", { p_slug: slugs.live });
      expect(error).toBeNull();
      const document = data as unknown as ProjectDocument;
      expect(Object.keys(document.project).sort()).toEqual(topLevelKeys(PROJECT_COLUMNS));
      expect(Object.keys(document.project.builders).sort()).toEqual(["id", "name"]);
    });

    it.each(["pending", "unpublished", "inactiveBuilder"] as const)(
      "does not open the %s project",
      async (which) => {
        const { data, error } = await visitorClient().rpc("public_project", {
          p_slug: slugs[which],
        });
        expect(error).toBeNull();
        expect(data).toBeNull();
      },
    );

    it("keeps a project's exact coordinates for the people who may read them (DEC-35)", async () => {
      const rows = rowsOf(
        await looseSignedIn().from("projects").select("latitude, longitude").eq("slug", slugs.live),
      );
      expect(rows).toEqual([{ latitude: 13.082741, longitude: 80.270741 }]);
    });

    it("gives the units and price trend of the live project only", async () => {
      const { data } = await visitorClient().rpc("public_project", { p_slug: slugs.live });
      const document = data as unknown as ProjectDocument;
      expect(document.units).toHaveLength(1);
      expect(Object.keys(document.units[0] ?? {}).sort()).toEqual(topLevelKeys(UNIT_COLUMNS));
      expect(document.trend).toHaveLength(1);
      expect(Object.keys(document.trend[0] ?? {}).sort()).toEqual(topLevelKeys(TREND_COLUMNS));
      expect(document.unit_count).toBe(1);
    });

    it.each(["moderation", "published", "rejection_reason", "moderated_by", "form_id"])(
      "refuses a signed-in person a read that names %s",
      async (column) => {
        const result = await looseSignedIn()
          .from("projects")
          .select(`${PROJECT_COLUMNS}, ${column}`)
          .limit(1);
        expect(result.error?.code).toBe("42501");
      },
    );

    it("gives the homepage developers through home_developers: the live project's builder only", async () => {
      const { data, error } = await visitorClient().rpc("home_developers");
      expect(error).toBeNull();
      const rows = (data as unknown as (Record<string, unknown> & { slug: string })[]).filter(
        (row) => row.slug.includes(RUN),
      );
      expect(rows.map((row) => row.slug)).toEqual([slugs.live]);
      expect(rows[0]?.["builder_id"]).toBe(activeBuilderId);
      expect(Object.keys(rows[0] ?? {}).sort()).toEqual(topLevelKeys(DEVELOPER_PROJECT_COLUMNS));
    });

    it("lists the live project in the sitemap read", async () => {
      const { data, error } = await visitorClient().rpc("sitemap_entries", {
        p_kind: "projects",
        p_limit: 1000,
        p_offset: 0,
      });
      expect(error).toBeNull();
      const rows = (data ?? []).filter((row) => row.slug.includes(RUN));
      expect(rows.map((row) => row.slug)).toEqual([slugs.live]);
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
