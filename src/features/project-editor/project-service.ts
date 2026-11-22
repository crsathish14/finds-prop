import { ActionError } from "@/server/actions/normalise-error";
import {
  areaApplies,
  bedroomsApply,
  offerTypeApplies,
  plotStatusApplies,
  possessionApplies,
  villaTypeApplies,
} from "./rules";
import type {
  CreateMyProjectInput,
  CreateProjectInput,
  UpdateMyProjectInput,
  UpdateProjectInput,
} from "./schemas";

/**
 * The rules of saving a project (S7-T02, FR-ADM-03, FR-BLD-02), apart from the code that reaches the database so they
 * can be tested with a stand-in. The real store is in `service.ts`: it acts as the signed-in admin or builder, so the
 * database's own rules decide what may be written: a builder writes only their own projects and cannot hand one to
 * another builder or choose its enquiry form; a project's address is locked for a builder once it has been
 * approved; a builder's edit sends the project back to review (BR-41) and an admin's does not. The action has already
 * checked the role and counted the rate limit.
 */

/** The columns of a project the form writes. A column that is not in the object is left as it is. */
export interface ProjectRow {
  name?: string;
  slug?: string;
  project_type?: string | null;
  property_type?: string | null;
  project_status?: string | null;
  offer_type?: string | null;
  plot_status?: string | null;
  villa_type?: string | null;
  price?: number | null;
  price_type?: string | null;
  area_min_sqft?: number | null;
  area_max_sqft?: number | null;
  bhk_options?: number[];
  land_area_acres?: number | null;
  possession_date?: string | null;
  contact_phone?: string | null;
  locality?: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  advantages?: string[];
  nearby?: string[];
  rera_applicable?: boolean;
  rera_number?: string | null;
  rera_not_applicable_reason?: string | null;
  description?: string | null;
  specifications?: string | null;
  amenities?: string[];
  seo_title?: string | null;
  seo_description?: string | null;
  images?: string[];
  floor_plans?: string[];
  elevations?: string[];
  plot_images?: string[];
  videos?: string[];
  brochure_path?: string | null;
  form_id?: string | null;
  extra_fields?: Record<string, string>;
}

/** A month of the price trends as the database function takes it. */
export type TrendRow = {
  month: string;
  price_per_sqft: number;
};

/** Which project was saved and where it stands: enough to refresh its public pages and to say what happened. */
export interface ProjectDone {
  projectId: string;
  slug: string;
  /** Its address before the save, when the save changed it: the old page is refreshed too. */
  previousSlug: string | null;
  /** Its state after the save, and before it (null for a project that did not exist). */
  moderation: string;
  previousModeration: string | null;
}

/** Calls made as the signed-in admin or builder. */
export interface ProjectStore {
  /** Adds a project; a builder's own id is the database's default. Throws the database's failure through `mapProjectError`. */
  insert(
    row: ProjectRow & { name: string; slug: string; locality: string },
    builderId?: string,
  ): Promise<ProjectDone>;
  /** Saves a project; null when there is no such project (or it is not theirs). */
  update(projectId: string, row: ProjectRow): Promise<ProjectDone | null>;
  /** Replaces a project's price trends with these months. The admin only. */
  saveTrends(projectId: string, rows: TrendRow[]): Promise<void>;
}

/** What the database says when a call fails. */
export interface ProjectFailure {
  code?: string | undefined;
  message?: string | undefined;
  details?: string | undefined;
}

const says = (failure: ProjectFailure, text: string): boolean =>
  (failure.message ?? "").includes(text) || (failure.details ?? "").includes(text);

/**
 * Turns what the database raises into the closed set of action errors. A rule about one box goes on that box (a
 * taken or locked address, a price range that runs backwards, coordinates given by halves); a rule about who may do
 * what is "not allowed"; anything else is ours.
 */
export function mapProjectError(failure: ProjectFailure): ActionError {
  const { code } = failure;
  const onBox = (field: string, key: string, text: string) =>
    new ActionError("VALIDATION", text, { fieldErrors: { [field]: [{ key }] } });

  if (code === "23505" && says(failure, "projects_slug_key")) {
    return onBox("slug", "validation.slugTaken", "That page address is already used");
  }
  if (says(failure, "projects.slug_locked")) {
    return onBox("slug", "validation.slugLocked", "The page address cannot change once approved");
  }
  if (says(failure, "projects.rera_number_required")) {
    return onBox("reraNumber", "validation.required", "The RERA number is required");
  }
  if (says(failure, "projects.rera_reason_required")) {
    return onBox(
      "reraNotApplicableReason",
      "validation.required",
      "The reason RERA does not apply is required",
    );
  }
  if (says(failure, "projects.plot_status_required")) {
    return onBox("plotStatus", "validation.required", "The plot status is required");
  }
  if (says(failure, "projects.villa_type_required")) {
    return onBox("villaType", "validation.required", "The villa type is required");
  }
  if (says(failure, "projects_possession_for_status")) {
    return onBox(
      "possessionDate",
      "validation.invalid",
      "The possession month does not fit the status",
    );
  }
  if (says(failure, "projects_property_type_fits")) {
    return onBox(
      "propertyType",
      "validation.invalid",
      "That property type does not fit the project type",
    );
  }
  if (says(failure, "projects_area_range")) {
    return onBox("areaMaxSqft", "validation.areaRange", "The largest area is below the smallest");
  }
  if (says(failure, "projects_price_type")) {
    return onBox("priceType", "validation.invalid", "That price type does not fit the project");
  }
  if (says(failure, "projects_coordinates_together")) {
    return onBox("longitude", "validation.coordinatesTogether", "Give both coordinates or none");
  }
  if (
    says(failure, "projects.builder_immutable") ||
    says(failure, "projects.builder_mismatch") ||
    says(failure, "projects.form_admin_only") ||
    says(failure, "projects.initial_values") ||
    says(failure, "projects.moderation_system_only") ||
    code === "42501"
  ) {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  if (code === "23503" && says(failure, "builder_id")) {
    return onBox("builderId", "validation.invalid", "That builder was not found");
  }
  if (code === "23503" && says(failure, "form_id")) {
    return onBox("formId", "validation.invalid", "That form was not found");
  }
  if (code === "23514" || code === "22P02" || code === "23502" || code === "22003") {
    return new ActionError("VALIDATION", "The project's details are not valid");
  }
  return new ActionError("INTERNAL", "The project could not be saved");
}

type Fields = CreateMyProjectInput | UpdateMyProjectInput | CreateProjectInput | UpdateProjectInput;

/** Sets a column only when the form gave a value for it (a blank box is null, which clears it). */
function put<Key extends keyof ProjectRow>(
  row: ProjectRow,
  key: Key,
  value: ProjectRow[Key] | undefined,
): void {
  if (value !== undefined) row[key] = value;
}

/**
 * The columns from what the form gave (ADR-148). What does not apply to this kind of project is cleared, whatever the
 * form sent: bedrooms only for a residential apartment or villa, the sale or rent choice only for a commercial
 * project, the area range only for a plot and commercial projects, the possession month only while the project is
 * still to be built, the RERA number only when RERA applies and the reason only when it does not (the database
 * refuses a number without RERA, so a leftover box never blocks a save).
 */
export function projectRowFrom(
  input: Fields,
): ProjectRow & { name: string; slug: string; locality: string } {
  const row: ProjectRow & { name: string; slug: string; locality: string } = {
    name: input.name,
    slug: input.slug,
    locality: input.locality,
    rera_applicable: input.reraApplicable,
    project_type: input.projectType,
    property_type: input.propertyType,
    project_status: input.projectStatus,
    offer_type: offerTypeApplies(input.projectType) ? (input.offerType ?? null) : null,
    plot_status: plotStatusApplies(input.propertyType) ? (input.plotStatus ?? null) : null,
    villa_type: villaTypeApplies(input.propertyType) ? (input.villaType ?? null) : null,
    price: input.price,
    price_type: input.priceType,
    bhk_options: bedroomsApply(input.projectType, input.propertyType)
      ? (input.bhkOptions ?? [])
      : [],
    possession_date: possessionApplies(input.projectStatus) ? (input.possessionDate ?? null) : null,
    rera_number: input.reraApplicable ? (input.reraNumber ?? null) : null,
    rera_not_applicable_reason: input.reraApplicable
      ? null
      : (input.reraNotApplicableReason ?? null),
  };
  const sized = areaApplies(input.projectType, input.propertyType);
  row.area_min_sqft = sized ? (input.areaMinSqft ?? null) : null;
  row.area_max_sqft = sized ? (input.areaMaxSqft ?? null) : null;
  put(row, "land_area_acres", input.landAreaAcres);
  put(row, "contact_phone", input.contactPhone);
  put(row, "address", input.address);
  put(row, "latitude", input.latitude);
  put(row, "longitude", input.longitude);
  put(row, "advantages", input.advantages);
  put(row, "nearby", input.nearby);
  put(row, "description", input.description);
  put(row, "specifications", input.specifications);
  put(row, "amenities", input.amenities);
  put(row, "seo_title", input.seoTitle);
  put(row, "seo_description", input.seoDescription);
  put(row, "extra_fields", input.extraFields);
  if ("images" in input) {
    put(row, "images", input.images);
    put(row, "floor_plans", input.floorPlans);
    put(row, "elevations", input.elevations);
    put(row, "plot_images", input.plotImages);
    put(row, "videos", input.videos);
    put(row, "brochure_path", input.brochure);
  }
  if ("formId" in input) put(row, "form_id", input.formId);
  return row;
}

/** The months as the database function takes them: the first of each month. */
export function trendRowsFrom(trends: { month: string; pricePerSqft: number }[]): TrendRow[] {
  return trends.map((trend) => ({
    month: `${trend.month}-01`,
    price_per_sqft: trend.pricePerSqft,
  }));
}

/** A builder adds a project of their own, or the admin adds one for the builder they name. */
export async function addProject(
  store: ProjectStore,
  input: CreateMyProjectInput | CreateProjectInput,
): Promise<ProjectDone> {
  const builderId = "builderId" in input ? input.builderId : undefined;
  return store.insert(projectRowFrom(input), builderId);
}

/**
 * Saves a project, then its price trends when the admin sent them. The two are separate writes, so a failure of the
 * second leaves the project saved and says so: the page reads the project again and shows what is stored.
 */
export async function saveProject(
  store: ProjectStore,
  input: UpdateMyProjectInput | UpdateProjectInput,
): Promise<ProjectDone> {
  const done = await store.update(input.projectId, projectRowFrom(input));
  if (!done) throw new ActionError("NOT_FOUND", "That project was not found");
  if ("priceTrends" in input && input.priceTrends !== undefined) {
    await store.saveTrends(input.projectId, trendRowsFrom(input.priceTrends));
  }
  return done;
}
