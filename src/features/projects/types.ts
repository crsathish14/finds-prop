import type {
  OFFER_TYPES,
  PLOT_STATUSES,
  PRICE_TYPES,
  PROJECT_STATUSES,
  PROPERTY_TYPES,
  UNIT_STATUSES,
  VILLA_TYPES,
} from "./schemas";

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type PriceType = (typeof PRICE_TYPES)[number];
export type OfferType = (typeof OFFER_TYPES)[number];
export type ProjectPropertyType = (typeof PROPERTY_TYPES)[number];
export type ProjectPlotStatus = (typeof PLOT_STATUSES)[number];
export type ProjectVillaType = (typeof VILLA_TYPES)[number];
export type UnitStatus = (typeof UNIT_STATUSES)[number];

/** One project on the list: only what its card draws, with the names of the page (not the columns'). */
export type ProjectListItem = {
  slug: string;
  name: string;
  developerName: string;
  /** The developer's id, for the AI search's promotion order (ADR-205); absent where the list item is made by hand. */
  builderId?: string;
  status: ProjectStatus | null;
  /** Sale or rent; only a commercial project has one. */
  offerType: OfferType | null;
  /** Whole rupees: the one price, or null when there is none. What it means is `priceType`. */
  price: number | null;
  priceType: PriceType | null;
  /** The BHK sizes on offer, as stored (order and repeats do not matter). */
  bhkOptions: number[];
  locality: string;
  /** The first picture's path in the public project bucket, or null. */
  coverPath: string | null;
  featured: boolean;
};

/** One unit of a project, as the units table draws it. */
export type ProjectUnit = {
  number: string;
  floor: number | null;
  bhk: number | null;
  areaSqft: number | null;
  facing: string | null;
  /** Whole rupees; null when the developer gave none. */
  price: number | null;
  status: UnitStatus;
  floorPlanPath: string | null;
};

/** One month of the price trend. */
export type TrendPoint = {
  /** The first day of the month, `YYYY-MM-DD`. */
  month: string;
  pricePerSqft: number;
};

/**
 * One project as the project page holds it: only what a visitor may see, with the names of the page
 * and nothing computed for display. The words and the formatting are the page's.
 */
export type ProjectData = {
  id: string;
  slug: string;
  name: string;
  developer: { id: string; name: string };
  status: ProjectStatus | null;
  propertyType: ProjectPropertyType | null;
  plotStatus: ProjectPlotStatus | null;
  villaType: ProjectVillaType | null;
  /** The answers to the extra boxes the super admin defines, by box id (ADR-168). */
  extraFields: Record<string, string>;
  offerType: OfferType | null;
  price: number | null;
  priceType: PriceType | null;
  /** Whole rupees, given only by a project for rent (ADR-214). */
  securityDeposit: number | null;
  maintenancePerMonth: number | null;
  /** The smallest and largest area in square feet: a plot and a commercial project give them. */
  areaMinSqft: number | null;
  areaMaxSqft: number | null;
  bhkOptions: number[];
  landAreaAcres: number | null;
  /** What the developer says the whole project has; the units below may be fewer. */
  totalUnits: number | null;
  /** `YYYY-MM-DD`, as stored (always the first of a month). */
  possessionDate: string | null;
  contactPhone: string | null;
  locality: string;
  advantages: string[];
  nearby: string[];
  reraApplicable: boolean;
  reraNumber: string | null;
  /** Why a project that is not under RERA is not: public, written by the developer, so untrusted text. */
  reraNotApplicableReason: string | null;
  description: string | null;
  specifications: string | null;
  amenities: string[];
  /** Paths in the public project bucket, the cover first. */
  images: string[];
  floorPlans: string[];
  /** Web links as stored; the page draws only the safe ones (`videoLinks`). */
  videos: string[];
  brochurePath: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  featured: boolean;
  /** The first few units (`UNITS_SHOWN`), in the order of the table. */
  units: ProjectUnit[];
  /** How many units the project has in all. */
  unitCount: number;
  /** How many of them are available. */
  availableCount: number;
  /** The latest months of the price trend, oldest first. */
  trend: TrendPoint[];
};
