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
  priceMin: number | null;
  priceMax: number | null;
  bhkOptions: number[];
  landAreaAcres: number | null;
  totalUnits: number | null;
  /** yyyy-mm-dd */
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
  price_min: number | null;
  price_max: number | null;
  bhk_options: number[];
  land_area_acres: number | string | null;
  total_units: number | null;
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
    priceMin: row.price_min,
    priceMax: row.price_max,
    bhkOptions: row.bhk_options,
    landAreaAcres: asNumber(row.land_area_acres),
    totalUnits: row.total_units,
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
