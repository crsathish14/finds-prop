import type { PROJECT_STATUSES, UNIT_STATUSES } from "./schemas";

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type UnitStatus = (typeof UNIT_STATUSES)[number];

/** One project on the list: only what its card draws, with the names of the page (not the columns'). */
export type ProjectListItem = {
  slug: string;
  name: string;
  developerName: string;
  status: ProjectStatus | null;
  /** Whole rupees; the lowest price on offer, or null when the developer gave none. */
  priceMin: number | null;
  priceMax: number | null;
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
  priceMin: number | null;
  priceMax: number | null;
  bhkOptions: number[];
  landAreaAcres: number | null;
  /** What the developer says the whole project has; the units below may be fewer. */
  totalUnits: number | null;
  /** `YYYY-MM-DD`, as stored. */
  possessionDate: string | null;
  contactPhone: string | null;
  locality: string;
  advantages: string[];
  nearby: string[];
  reraApplicable: boolean;
  reraNumber: string | null;
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
