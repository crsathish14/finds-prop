/** A month of the price trends as the form shows it: "2026-10" and the price per square foot. */
export interface TrendView {
  month: string;
  pricePerSqft: number;
}

/** One project as the edit form opens it (S7-T02): every box, the media, where it stands and who owns it. */
export interface ProjectEditView {
  id: string;
  name: string;
  slug: string;
  builderId: string;
  projectType: string | null;
  propertyType: string | null;
  projectStatus: string | null;
  /** Sale or rent; only a commercial project has one. */
  offerType: string | null;
  plotStatus: string | null;
  villaType: string | null;
  /** The answers to the extra boxes, by box id (ADR-168). */
  extraFields: Record<string, string>;
  price: number | null;
  priceType: string | null;
  /** The area range in square feet: a plot and every commercial project. */
  areaMinSqft: number | null;
  areaMaxSqft: number | null;
  bhkOptions: number[];
  landAreaAcres: number | null;
  /** yyyy-mm-dd, the first day of the month */
  possessionDate: string | null;
  contactPhone: string | null;
  locality: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  advantages: string[];
  nearby: string[];
  reraApplicable: boolean;
  reraNumber: string | null;
  /** Public, like the number: why a project that is not under RERA is not. */
  reraNotApplicableReason: string | null;
  description: string | null;
  specifications: string | null;
  amenities: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  images: string[];
  floorPlans: string[];
  elevations: string[];
  plotImages: string[];
  videos: string[];
  brochure: string | null;
  /** The form the admin chose for the project page; none means the standard one. */
  formId: string | null;
  moderation: string;
  published: boolean;
  featured: boolean;
  rejectionReason: string | null;
  trends: TrendView[];
}

/** The builders the admin can give a project to. */
export interface BuilderOption {
  id: string;
  name: string;
  active: boolean;
}

/** The forms the admin can choose for a project page. */
export interface FormOption {
  id: string;
  name: string;
}

/** What `admin_projects()` and `my_projects()` return for a project. */
export interface ProjectDbRow {
  id: string;
  name: string;
  slug: string;
  builder_id: string;
  project_type: string | null;
  property_type: string | null;
  project_status: string | null;
  offer_type: string | null;
  plot_status: string | null;
  villa_type: string | null;
  extra_fields?: unknown;
  price: number | null;
  price_type: string | null;
  area_min_sqft: number | string | null;
  area_max_sqft: number | string | null;
  bhk_options: number[];
  land_area_acres: number | string | null;
  possession_date: string | null;
  contact_phone: string | null;
  locality: string;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  advantages: string[];
  nearby: string[];
  rera_applicable: boolean;
  rera_number: string | null;
  rera_not_applicable_reason: string | null;
  description: string | null;
  specifications: string | null;
  amenities: string[];
  seo_title: string | null;
  seo_description: string | null;
  images: string[];
  floor_plans: string[];
  elevations: string[];
  plot_images: string[];
  videos: string[];
  brochure_path: string | null;
  form_id: string | null;
  moderation: string;
  published: boolean;
  featured: boolean;
  rejection_reason: string | null;
}

/** The stored answers to the extra boxes: only text values count, anything else is ignored (ADR-168). */
export function extraFieldsOf(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const answers: Record<string, string> = {};
  for (const [id, typed] of Object.entries(value)) {
    if (typeof typed === "string") answers[id] = typed;
  }
  return answers;
}

/** A numeric column may arrive as text; a value that is not a number is none. */
const asNumber = (value: number | string | null): number | null => {
  if (value === null) return null;
  const converted = typeof value === "number" ? value : Number(value);
  return Number.isFinite(converted) ? converted : null;
};

/** Pure: a project row and its price trends as the edit form opens them. The months are "yyyy-mm". */
export function toProjectEditView(
  row: ProjectDbRow,
  trends: { month: string; price_per_sqft: number }[],
): ProjectEditView {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    builderId: row.builder_id,
    projectType: row.project_type,
    propertyType: row.property_type,
    projectStatus: row.project_status,
    offerType: row.offer_type,
    plotStatus: row.plot_status,
    villaType: row.villa_type,
    extraFields: extraFieldsOf(row.extra_fields),
    price: row.price,
    priceType: row.price_type,
    areaMinSqft: asNumber(row.area_min_sqft),
    areaMaxSqft: asNumber(row.area_max_sqft),
    bhkOptions: row.bhk_options,
    landAreaAcres: asNumber(row.land_area_acres),
    possessionDate: row.possession_date,
    contactPhone: row.contact_phone,
    locality: row.locality,
    address: row.address,
    latitude: asNumber(row.latitude),
    longitude: asNumber(row.longitude),
    advantages: row.advantages,
    nearby: row.nearby,
    reraApplicable: row.rera_applicable,
    reraNumber: row.rera_number,
    reraNotApplicableReason: row.rera_not_applicable_reason,
    description: row.description,
    specifications: row.specifications,
    amenities: row.amenities,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    images: row.images,
    floorPlans: row.floor_plans,
    elevations: row.elevations,
    plotImages: row.plot_images,
    videos: row.videos,
    brochure: row.brochure_path,
    formId: row.form_id,
    moderation: row.moderation,
    published: row.published,
    featured: row.featured,
    rejectionReason: row.rejection_reason,
    trends: trends
      .map((trend) => ({ month: trend.month.slice(0, 7), pricePerSqft: trend.price_per_sqft }))
      .sort((first, second) => first.month.localeCompare(second.month)),
  };
}

/** One project as the builder's list shows it (S7-T03): the name and place, the price and what it means, where it stands and a cover. */
export interface ProjectListRow {
  id: string;
  name: string;
  slug: string;
  locality: string;
  price: number | null;
  priceType: string | null;
  /** The first image's path in the media bucket, or none. */
  cover: string | null;
  moderation: string;
  published: boolean;
  featured: boolean;
}

/** The columns the list reads from `my_projects()`. */
export type ProjectListDbRow = Pick<
  ProjectDbRow,
  | "id"
  | "name"
  | "slug"
  | "locality"
  | "price"
  | "price_type"
  | "images"
  | "moderation"
  | "published"
  | "featured"
>;

/** Pure: a project row as the list shows it. */
export function toProjectListRow(row: ProjectListDbRow): ProjectListRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    locality: row.locality,
    price: row.price,
    priceType: row.price_type,
    cover: row.images[0] ?? null,
    moderation: row.moderation,
    published: row.published,
    featured: row.featured,
  };
}
