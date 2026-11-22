import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { adminClient, visitorClient } from "./support/clients";
import {
  createBuilderRecord,
  grantRole,
  removeTestAdmin,
  removeTestUser,
  signInTestAdmin,
  signInTestCustomer,
  type TestUser,
} from "./support/users";

// Outside a request there is no cookie or header store; the stores below take their clients directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { projectStore } = await import("@/features/project-editor/service");
const { addProject, saveProject } = await import("@/features/project-editor/project-service");
const { readBuilderOptions, readFormOptions, readMyProjectList, readProjectForEdit } =
  await import("@/features/project-editor/queries");
const { createMyProjectSchema, createProjectSchema, updateMyProjectSchema, updateProjectSchema } =
  await import("@/features/project-editor/schemas");
const { ActionError } = await import("@/server/actions/normalise-error");

const RUN = randomUUID().slice(0, 8);
const slug = (name: string) => `it-editor-${RUN}-${name}`;

/** What every save needs (ADR-148): a residential apartment, ready to move, with a price and no RERA (so its reason). */
const COMPLETE = {
  projectType: "residential",
  propertyType: "apartment",
  projectStatus: "ready_to_move",
  price: "7800000",
  priceType: "basic",
  reraApplicable: false,
  reraNotApplicableReason: "Below the size that needs registration.",
};

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("IT-project-editor: the project form's saves and reads against a real database (S7-T02, FR-ADM-03, FR-BLD-02)", () => {
  const admin = adminClient();
  let staff: TestUser;
  let builder: TestUser;
  let builderId: string;
  let otherBuilderId: string;
  let otherProjectId: string;
  let formId: string;
  let inactiveFormId: string;
  const projectIds: string[] = [];

  const asAdmin = () => projectStore(staff.client, "admin");
  const asBuilder = () => projectStore(builder.client, "builder");

  const row = async (projectId: string) => {
    const { data, error } = await admin.from("projects").select("*").eq("id", projectId).single();
    if (error) throw new Error(`Could not read the project (${error.code})`);
    return data;
  };

  /** Makes a project public and reviewed, as the system does when the admin approves it. */
  const approve = async (projectId: string) => {
    const { error } = await admin
      .from("projects")
      .update({ moderation: "approved", published: true, moderated_at: new Date().toISOString() })
      .eq("id", projectId);
    if (error) throw new Error(`Could not approve the project (${error.code})`);
  };

  const makeMine = async (name: string, extra: Record<string, unknown> = {}) => {
    const done = await addProject(
      asBuilder(),
      createMyProjectSchema.parse({
        ...COMPLETE,
        name: `Project ${name} ${RUN}`,
        slug: slug(name),
        locality: "Integration Test Locality",
        ...extra,
      }),
    );
    projectIds.push(done.projectId);
    return done;
  };

  beforeAll(async () => {
    staff = await signInTestAdmin();
    builder = await signInTestCustomer();
    await grantRole(builder.userId, "builder");
    builderId = await createBuilderRecord(builder.userId, { active: true });

    const other = await admin
      .from("builders")
      .insert({ email: `it-other-${RUN}@example.test`, name: `Other Builder ${RUN}` })
      .select("id")
      .single();
    if (other.error) throw new Error(`Could not add the other builder (${other.error.code})`);
    otherBuilderId = other.data.id;
    const project = await admin
      .from("projects")
      .insert({
        slug: slug("theirs"),
        name: `Their project ${RUN}`,
        builder_id: otherBuilderId,
        locality: "Integration Test Locality",
      })
      .select("id")
      .single();
    if (project.error) throw new Error(`Could not add their project (${project.error.code})`);
    otherProjectId = project.data.id;
    projectIds.push(otherProjectId);

    const forms = await admin
      .from("forms")
      .insert([
        {
          name: `IT editor form ${RUN}`,
          slug: `it-editor-form-${RUN}`,
          kind: "enquiry",
          active: true,
        },
        {
          name: `IT editor off ${RUN}`,
          slug: `it-editor-off-${RUN}`,
          kind: "enquiry",
          active: false,
        },
      ])
      .select("id, active");
    if (forms.error) throw new Error(`Could not add the forms (${forms.error.code})`);
    formId = forms.data.find((form) => form.active)?.id ?? "";
    inactiveFormId = forms.data.find((form) => !form.active)?.id ?? "";
  });

  afterAll(async () => {
    await admin.from("projects").delete().in("id", projectIds);
    await admin.from("forms").delete().in("id", [formId, inactiveFormId]);
    await admin.from("builders").delete().eq("id", otherBuilderId);
    await removeTestUser();
    await removeTestAdmin();
  });

  describe("adding a project", () => {
    it("lets a builder add their own project, which starts in review", async () => {
      const done = await makeMine("mine", { price: "7800000" });
      expect(done).toMatchObject({
        slug: slug("mine"),
        moderation: "pending",
        previousModeration: null,
      });
      expect(await row(done.projectId)).toMatchObject({
        builder_id: builderId,
        moderation: "pending",
        published: false,
        price: 7800000,
        price_type: "basic",
        rera_applicable: false,
        rera_not_applicable_reason: "Below the size that needs registration.",
      });
    });

    it("lets the admin add a project for the builder they name, in review too", async () => {
      const done = await addProject(
        asAdmin(),
        createProjectSchema.parse({
          ...COMPLETE,
          builderId,
          formId,
          name: `Admin made ${RUN}`,
          slug: slug("admin-made"),
          locality: "Integration Test Locality",
        }),
      );
      projectIds.push(done.projectId);
      expect(await row(done.projectId)).toMatchObject({
        builder_id: builderId,
        form_id: formId,
        moderation: "pending",
      });
    });

    it("puts a taken page address on the address's own box", async () => {
      await makeMine("taken");
      const error = await failureOf(() => makeMine("taken"));
      expect(error).toMatchObject({
        code: "VALIDATION",
        fieldErrors: { slug: [{ key: "validation.slugTaken" }] },
      });
    });

    it("refuses a visitor who is not signed in", async () => {
      const error = await failureOf(() =>
        addProject(
          projectStore(visitorClient(), "builder"),
          createMyProjectSchema.parse({
            ...COMPLETE,
            name: "Nobody",
            slug: slug("nobody"),
            locality: "Nowhere",
          }),
        ),
      );
      expect(error).toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("saving a project", () => {
    it("sends an approved project back to review when its builder changes it (BR-41), and says so", async () => {
      const made = await makeMine("review");
      await approve(made.projectId);
      const done = await saveProject(
        asBuilder(),
        updateMyProjectSchema.parse({
          ...COMPLETE,
          projectId: made.projectId,
          name: `Renamed ${RUN}`,
          slug: slug("review"),
          locality: "Integration Test Locality",
        }),
      );
      expect(done).toMatchObject({ moderation: "pending", previousModeration: "approved" });
      expect(await row(made.projectId)).toMatchObject({
        name: `Renamed ${RUN}`,
        moderation: "pending",
      });
    });

    it("leaves an approved project approved when the admin changes it", async () => {
      const made = await makeMine("admin-edit");
      await approve(made.projectId);
      const done = await saveProject(
        asAdmin(),
        updateProjectSchema.parse({
          ...COMPLETE,
          projectId: made.projectId,
          name: `Admin renamed ${RUN}`,
          slug: slug("admin-edit"),
          locality: "Integration Test Locality",
        }),
      );
      expect(done).toMatchObject({ moderation: "approved", previousModeration: "approved" });
      expect(await row(made.projectId)).toMatchObject({ published: true });
    });

    it("locks the page address for a builder once approved, and lets the admin change it, answering the old one", async () => {
      const made = await makeMine("locked");
      await approve(made.projectId);
      const change = (to: string) => ({
        ...COMPLETE,
        projectId: made.projectId,
        name: `Locked ${RUN}`,
        slug: to,
        locality: "Integration Test Locality",
      });
      const refused = await failureOf(() =>
        saveProject(asBuilder(), updateMyProjectSchema.parse(change(slug("locked-new")))),
      );
      expect(refused).toMatchObject({
        code: "VALIDATION",
        fieldErrors: { slug: [{ key: "validation.slugLocked" }] },
      });
      const done = await saveProject(
        asAdmin(),
        updateProjectSchema.parse(change(slug("locked-admin"))),
      );
      expect(done).toMatchObject({ slug: slug("locked-admin"), previousSlug: slug("locked") });
    });

    it("saves the media paths of the project's own folder and every box", async () => {
      const made = await makeMine("media");
      const done = await saveProject(
        asBuilder(),
        updateMyProjectSchema.parse({
          ...COMPLETE,
          projectId: made.projectId,
          name: `Media ${RUN}`,
          slug: slug("media"),
          locality: "Integration Test Locality",
          projectType: "residential",
          bhkOptions: ["3", "2"],
          advantages: ["Near the beach", "IT corridor"],
          amenities: ["Clubhouse"],
          reraApplicable: true,
          reraNumber: "TN/29/Building/0123/2026",
          latitude: "12.84",
          longitude: "80.23",
          images: [`${made.projectId}/cover.webp`],
          brochure: `${made.projectId}/brochure.pdf`,
          videos: ["https://video.example/walkthrough"],
        }),
      );
      expect(done.moderation).toBe("pending");
      expect(await row(made.projectId)).toMatchObject({
        project_type: "residential",
        bhk_options: [2, 3],
        advantages: ["Near the beach", "IT corridor"],
        amenities: ["Clubhouse"],
        rera_applicable: true,
        rera_number: "TN/29/Building/0123/2026",
        images: [`${made.projectId}/cover.webp`],
        brochure_path: `${made.projectId}/brochure.pdf`,
        videos: ["https://video.example/walkthrough"],
      });
    });

    it("drops the RERA number when RERA does not apply, so a leftover box never blocks a save", async () => {
      const made = await makeMine("rera");
      await saveProject(
        asBuilder(),
        updateMyProjectSchema.parse({
          ...COMPLETE,
          projectId: made.projectId,
          name: `Rera ${RUN}`,
          slug: slug("rera"),
          locality: "Integration Test Locality",
          reraApplicable: false,
          reraNumber: "TN/1",
        }),
      );
      expect(await row(made.projectId)).toMatchObject({
        rera_applicable: false,
        rera_number: null,
      });
    });

    it("saves a plot priced per sq ft and a commercial project for rent with the new columns, and reads them back", async () => {
      const made = await makeMine("kinds");
      const input = (extra: Record<string, unknown>) =>
        updateMyProjectSchema.parse({
          ...COMPLETE,
          projectId: made.projectId,
          name: `Kinds ${RUN}`,
          slug: slug("kinds"),
          locality: "Integration Test Locality",
          ...extra,
        });
      await saveProject(
        asBuilder(),
        input({
          propertyType: "plot",
          plotStatus: "investment",
          priceType: "per_sqft",
          price: "2,450",
          areaMinSqft: "1200",
          areaMaxSqft: "2400.5",
          bhkOptions: [3],
          offerType: "rent",
          possessionDate: "2028-12",
        }),
      );
      expect(await row(made.projectId)).toMatchObject({
        project_type: "residential",
        property_type: "plot",
        offer_type: null,
        price: 2450,
        price_type: "per_sqft",
        area_min_sqft: 1200,
        area_max_sqft: 2400.5,
        bhk_options: [],
        possession_date: null,
      });

      await saveProject(
        asBuilder(),
        input({
          projectType: "commercial",
          propertyType: "office",
          offerType: "rent",
          priceType: "rent_per_sqft_month",
          price: "85",
          areaMinSqft: "500",
          areaMaxSqft: "2500",
          projectStatus: "new_launch",
          possessionDate: "2028-12",
          reraApplicable: true,
          reraNumber: "TN/29/Building/0123/2026",
        }),
      );
      expect(await row(made.projectId)).toMatchObject({
        project_type: "commercial",
        property_type: "office",
        offer_type: "rent",
        price: 85,
        price_type: "rent_per_sqft_month",
        area_min_sqft: 500,
        area_max_sqft: 2500,
        possession_date: "2028-12-01",
        rera_applicable: true,
        rera_number: "TN/29/Building/0123/2026",
        rera_not_applicable_reason: null,
      });
      expect(await readProjectForEdit(builder.client, "builder", made.projectId)).toMatchObject({
        projectType: "commercial",
        propertyType: "office",
        offerType: "rent",
        price: 85,
        priceType: "rent_per_sqft_month",
        areaMinSqft: 500,
        areaMaxSqft: 2500,
        possessionDate: "2028-12-01",
        reraNotApplicableReason: null,
      });
    });

    it("puts the largest area below the smallest on the largest-area box when the database refuses it", async () => {
      const made = await makeMine("area");
      const error = await failureOf(() =>
        // A plot, so that the area range itself is what the database refuses.
        asBuilder().update(made.projectId, {
          property_type: "plot",
          plot_status: "investment",
          area_min_sqft: 2000,
          area_max_sqft: 1000,
        }),
      );
      expect(error).toMatchObject({
        code: "VALIDATION",
        fieldErrors: { areaMaxSqft: [{ key: "validation.areaRange" }] },
      });
    });

    it("puts a possession month that does not fit the status on the possession box, and coordinates given by halves on the longitude", async () => {
      const made = await makeMine("range");
      const possessionError = await failureOf(() =>
        // The project is ready to move, which has no possession month.
        asBuilder().update(made.projectId, { possession_date: "2028-12-01" }),
      );
      expect(possessionError).toMatchObject({
        code: "VALIDATION",
        fieldErrors: { possessionDate: [{ key: "validation.invalid" }] },
      });
      const placeError = await failureOf(() =>
        asBuilder().update(made.projectId, { latitude: 13, longitude: null }),
      );
      expect(placeError).toMatchObject({
        code: "VALIDATION",
        fieldErrors: { longitude: [{ key: "validation.coordinatesTogether" }] },
      });
    });

    it("refuses a builder a change to the form's own columns that leaves the project incomplete, and a RERA claim with no number", async () => {
      const made = await makeMine("incomplete");
      expect(
        await failureOf(() => asBuilder().update(made.projectId, { price: null })),
      ).toMatchObject({ code: "VALIDATION" });
      const rera = await failureOf(() =>
        asBuilder().update(made.projectId, {
          rera_applicable: true,
          rera_number: null,
          rera_not_applicable_reason: null,
        }),
      );
      expect(rera).toMatchObject({
        code: "VALIDATION",
        fieldErrors: { reraNumber: [{ key: "validation.required" }] },
      });
      expect((await row(made.projectId)).price).toBe(7800000);
    });

    it("lets the system and the admin approve a project whatever its form holds (the rules apply to the portal's writers)", async () => {
      const made = await makeMine("approve");
      await approve(made.projectId);
      expect(await row(made.projectId)).toMatchObject({ moderation: "approved", published: true });
    });

    it("says not found when a builder saves a project that is not theirs, and changes nothing", async () => {
      const error = await failureOf(() =>
        saveProject(
          asBuilder(),
          updateMyProjectSchema.parse({
            ...COMPLETE,
            projectId: otherProjectId,
            name: "Hijacked",
            slug: slug("theirs"),
            locality: "Integration Test Locality",
          }),
        ),
      );
      expect(error).toMatchObject({ code: "NOT_FOUND" });
      expect((await row(otherProjectId)).name).toBe(`Their project ${RUN}`);
    });

    it("refuses a builder the enquiry form, which only the admin chooses", async () => {
      const made = await makeMine("form");
      const error = await failureOf(() => asBuilder().update(made.projectId, { form_id: formId }));
      expect(error).toMatchObject({ code: "FORBIDDEN" });
      expect((await row(made.projectId)).form_id).toBeNull();
    });
  });

  describe("price trends", () => {
    it("saves the admin's list with the project: months added, changed and removed", async () => {
      const made = await makeMine("trends");
      const input = (priceTrends: { month: string; pricePerSqft: number }[]) =>
        updateProjectSchema.parse({
          ...COMPLETE,
          projectId: made.projectId,
          name: `Trends ${RUN}`,
          slug: slug("trends"),
          locality: "Integration Test Locality",
          priceTrends,
        });
      await saveProject(
        asAdmin(),
        input([
          { month: "2026-08", pricePerSqft: 8100 },
          { month: "2026-09", pricePerSqft: 8230 },
        ]),
      );
      await saveProject(
        asAdmin(),
        input([
          { month: "2026-09", pricePerSqft: 8300 },
          { month: "2026-10", pricePerSqft: 8350 },
        ]),
      );
      const view = await readProjectForEdit(staff.client, "admin", made.projectId);
      expect(view?.trends).toEqual([
        { month: "2026-09", pricePerSqft: 8300 },
        { month: "2026-10", pricePerSqft: 8350 },
      ]);
    });

    it("refuses a builder the price trends, which only the admin saves", async () => {
      const made = await makeMine("trends-builder");
      const error = await failureOf(() =>
        asBuilder().saveTrends(made.projectId, [{ month: "2026-10-01", price_per_sqft: 8000 }]),
      );
      expect(error).toMatchObject({ code: "FORBIDDEN" });
    });
  });

  describe("the form's reads", () => {
    it("opens a project for the admin with its review state, its media and its trends", async () => {
      const made = await makeMine("read");
      const view = await readProjectForEdit(staff.client, "admin", made.projectId);
      expect(view).toMatchObject({
        id: made.projectId,
        slug: slug("read"),
        builderId,
        moderation: "pending",
        published: false,
        formId: null,
        images: [],
        trends: [],
      });
    });

    it("opens a builder's own project for them, and no one else's", async () => {
      const made = await makeMine("read-own");
      expect(await readProjectForEdit(builder.client, "builder", made.projectId)).toMatchObject({
        id: made.projectId,
        builderId,
      });
      expect(await readProjectForEdit(builder.client, "builder", otherProjectId)).toBeNull();
      expect(await readProjectForEdit(staff.client, "admin", otherProjectId)).toMatchObject({
        id: otherProjectId,
        builderId: otherBuilderId,
      });
    });

    it("lists a builder's own projects for their Projects page, and no one else's", async () => {
      const made = await makeMine("list-own");
      const listed = await readMyProjectList(builder.client);
      expect(listed).toContainEqual(
        expect.objectContaining({
          id: made.projectId,
          slug: slug("list-own"),
          moderation: "pending",
          published: false,
          featured: false,
          cover: null,
        }),
      );
      expect(listed.some((project) => project.id === otherProjectId)).toBe(false);
    });

    it("gives a builder nothing from the admin's list, and refuses a visitor", async () => {
      await expect(readProjectForEdit(builder.client, "admin", otherProjectId)).resolves.toBeNull();
      await expect(
        readProjectForEdit(visitorClient(), "builder", otherProjectId),
      ).rejects.toBeTruthy();
    });

    it("offers the admin every builder by name, and only the active forms", async () => {
      const builders = await readBuilderOptions(staff.client);
      expect(builders).toContainEqual({ id: builderId, name: expect.any(String), active: true });
      expect(builders.some((option) => option.id === otherBuilderId)).toBe(true);
      const forms = await readFormOptions(staff.client);
      expect(forms).toContainEqual({ id: formId, name: `IT editor form ${RUN}` });
      expect(forms.some((option) => option.id === inactiveFormId)).toBe(false);
    });
  });
});
