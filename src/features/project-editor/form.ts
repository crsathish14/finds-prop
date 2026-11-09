import type { ProjectFieldName, ProjectFieldValues } from "@/components/domain/project-fields";
import type { ProjectMediaGroupName } from "@/components/domain/project-media";
import type { PriceTrendRow } from "@/components/domain/price-trends-editor";
import type {
  ProjectSectionId,
  ProjectSectionState,
} from "@/components/domain/project-section-nav";
import type { MediaItem } from "@/components/patterns/media-group-field";
import { SLUG_MAX, TREND_PRICE_MAX, TREND_PRICE_MIN } from "./constants";
import type { ProjectEditView } from "./view";

/**
 * The project form's pure helpers (S7-T02, part C): what the boxes hold when the form opens, what is sent when it
 * is saved, the page address suggested from the name, the media paths and the checks made before a file is sent.
 * Nothing here reads the clock, the network or the page, so the tests need no browser.
 */

/** The bucket the browser uploads to; a file lives at `<project id>/<file name>`. */
export const MEDIA_BUCKET = "project-media";

/** The bucket's own limit (10 MB); the bucket checks it again. */
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const MEDIA_MAX_MEGABYTES = 10;

/** The types a group offers, each with the extension its files are stored under. */
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const PDF_EXTENSIONS: Record<string, string> = { "application/pdf": "pdf" };

const EXTENSIONS_OF: Record<ProjectMediaGroupName, Record<string, string>> = {
  images: IMAGE_EXTENSIONS,
  floorPlans: IMAGE_EXTENSIONS,
  elevations: IMAGE_EXTENSIONS,
  plotImages: IMAGE_EXTENSIONS,
  brochure: PDF_EXTENSIONS,
};

export const MEDIA_GROUPS: readonly ProjectMediaGroupName[] = [
  "images",
  "floorPlans",
  "elevations",
  "plotImages",
  "brochure",
];

/** The boxes a new project's form opens with: nothing typed, RERA not claimed. */
export const EMPTY_PROJECT_VALUES: ProjectFieldValues = {
  name: "",
  builderId: "",
  projectType: "",
  propertyType: "",
  projectStatus: "",
  priceMin: "",
  priceMax: "",
  bhkOptions: [],
  landAreaAcres: "",
  totalUnits: "",
  possessionDate: "",
  contactPhone: "",
  locality: "",
  address: "",
  latitude: "",
  longitude: "",
  advantages: [],
  nearby: [],
  reraApplicable: false,
  reraNumber: "",
  description: "",
  specifications: "",
  amenities: [],
  seoTitle: "",
  slug: "",
  seoDescription: "",
};

const text = (value: string | number | null): string => (value === null ? "" : String(value));

/** The boxes as a saved project fills them: a blank box for anything not given. */
export function valuesOf(project: ProjectEditView): ProjectFieldValues {
  return {
    name: project.name,
    builderId: project.builderId,
    projectType: text(project.projectType),
    propertyType: text(project.propertyType),
    projectStatus: text(project.projectStatus),
    priceMin: text(project.priceMin),
    priceMax: text(project.priceMax),
    bhkOptions: project.bhkOptions,
    landAreaAcres: text(project.landAreaAcres),
    totalUnits: text(project.totalUnits),
    possessionDate: text(project.possessionDate),
    contactPhone: text(project.contactPhone),
    locality: project.locality,
    address: text(project.address),
    latitude: text(project.latitude),
    longitude: text(project.longitude),
    advantages: project.advantages,
    nearby: project.nearby,
    reraApplicable: project.reraApplicable,
    reraNumber: text(project.reraNumber),
    description: text(project.description),
    specifications: text(project.specifications),
    amenities: project.amenities,
    seoTitle: text(project.seoTitle),
    slug: project.slug,
    seoDescription: text(project.seoDescription),
  };
}

/** The page address a name suggests: lower case, accents dropped, words joined by single hyphens, cut to the limit. */
export function slugFromName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

/** The section each box sits in, for the section list and for scrolling to the first problem. */
export const SECTION_OF: Record<ProjectFieldName, ProjectSectionId> = {
  name: "basics",
  builderId: "basics",
  projectType: "basics",
  propertyType: "basics",
  projectStatus: "basics",
  priceMin: "basics",
  priceMax: "basics",
  bhkOptions: "basics",
  landAreaAcres: "basics",
  totalUnits: "basics",
  possessionDate: "basics",
  contactPhone: "basics",
  locality: "location",
  address: "location",
  latitude: "location",
  longitude: "location",
  advantages: "location",
  nearby: "location",
  reraApplicable: "rera",
  reraNumber: "rera",
  description: "details",
  specifications: "details",
  amenities: "details",
  seoTitle: "seo",
  slug: "seo",
  seoDescription: "seo",
};

/** The boxes a failure may name: the form's own, and the two the admin's side column adds. */
export type ProjectErrorField =
  ProjectFieldName | "formId" | "videos" | "priceTrends" | ProjectMediaGroupName;

const ERROR_FIELDS: readonly string[] = [
  ...Object.keys(SECTION_OF),
  "formId",
  "videos",
  "priceTrends",
  ...MEDIA_GROUPS,
];

/** A failure's field name as the form knows it: `images.2` is `images`; one the form has no box for is null. */
export function errorFieldOf(path: string): ProjectErrorField | null {
  const head = path.split(".")[0] ?? "";
  return ERROR_FIELDS.includes(head) ? (head as ProjectErrorField) : null;
}

/** The section a failure belongs to. */
export function sectionOfError(field: ProjectErrorField): ProjectSectionId | null {
  if (field === "formId" || field === "priceTrends") return null;
  if (field === "videos" || (MEDIA_GROUPS as readonly string[]).includes(field)) return "media";
  return SECTION_OF[field as ProjectFieldName];
}

/**
 * What each section of the list shows: a problem where a box has one; done where what the section needs is filled in
 * (the name, and the builder for the admin; the locality; the page address; the RERA number when RERA applies (a project that is not under RERA shows nothing); a
 * description; a file or a link); otherwise nothing.
 */
export function sectionStatesOf(input: {
  values: ProjectFieldValues;
  errorSections: ReadonlySet<ProjectSectionId>;
  needsBuilder: boolean;
  hasMedia: boolean;
}): Record<ProjectSectionId, ProjectSectionState> {
  const { values, errorSections, needsBuilder, hasMedia } = input;
  const filled = (value: string) => value.trim() !== "";
  const complete: Record<ProjectSectionId, boolean> = {
    basics: filled(values.name) && (!needsBuilder || filled(values.builderId)),
    location: filled(values.locality),
    rera: values.reraApplicable && filled(values.reraNumber),
    details: filled(values.description),
    media: hasMedia,
    seo: filled(values.slug),
  };
  const sections = Object.keys(complete) as ProjectSectionId[];
  return Object.fromEntries(
    sections.map((id) => [id, errorSections.has(id) ? "error" : complete[id] ? "done" : "idle"]),
  ) as Record<ProjectSectionId, ProjectSectionState>;
}

/** The address of a file in the public bucket, for the small picture on its tile. */
export function publicMediaUrl(baseUrl: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${encoded}`;
}

/** The name shown on a tile: the file's name without the short id that keeps stored names apart. */
export function displayNameOf(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/^[0-9a-f]{8}-/, "");
}

const isPdf = (path: string) => path.toLowerCase().endsWith(".pdf");

/** A stored path as a finished tile. */
export function itemOfPath(baseUrl: string, path: string): MediaItem {
  return isPdf(path)
    ? { id: path, name: displayNameOf(path), kind: "file", stage: "done" }
    : {
        id: path,
        name: displayNameOf(path),
        kind: "image",
        previewUrl: publicMediaUrl(baseUrl, path),
        stage: "done",
      };
}

/** What each group holds when a saved project opens. */
export function mediaOf(
  baseUrl: string,
  project: ProjectEditView | null,
): Record<ProjectMediaGroupName, MediaItem[]> {
  const items = (paths: readonly string[]) => paths.map((path) => itemOfPath(baseUrl, path));
  return {
    images: items(project?.images ?? []),
    floorPlans: items(project?.floorPlans ?? []),
    elevations: items(project?.elevations ?? []),
    plotImages: items(project?.plotImages ?? []),
    brochure: items(project?.brochure ? [project.brochure] : []),
  };
}

/** Why a file cannot go to a group: its type is not offered, or it is over the limit. Null when it can. */
export function fileProblem(
  file: { type: string; size: number },
  group: ProjectMediaGroupName,
): "type" | "size" | null {
  if (!(file.type in EXTENSIONS_OF[group])) return "type";
  if (file.size > MEDIA_MAX_BYTES) return "size";
  return null;
}

/**
 * Where a file goes in the bucket: `<project id>/<8 hex of the id>-<its own name, tidied>.<extension>`. The short id keeps two
 * files of the same name apart and the name keeps the tile readable; the whole stays inside what the server accepts
 * (letters, digits, dot, underscore and hyphen, at most 120 characters after the folder).
 */
export function uploadPath(
  projectId: string,
  uniqueId: string,
  file: { name: string; type: string },
  group: ProjectMediaGroupName,
): string {
  const extension = EXTENSIONS_OF[group][file.type] ?? "bin";
  const base = file.name
    .replace(/\.[^.]*$/, "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  const short = uniqueId.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `${projectId}/${short}-${base === "" ? "file" : base}.${extension}`;
}

/** A message key (under admin.projectForm.trends.errors) for each row with a problem. */
export type TrendProblem = { month?: "missing" | "twice"; price?: "missing" | "number" | "range" };

/**
 * The price trends as the form can check them before a save: a month and a price on every row (a row with neither is
 * left out), no month twice, a whole price from 1 to 10 million. The server checks again.
 */
export function trendProblems(rows: readonly PriceTrendRow[]): Record<string, TrendProblem> {
  const problems: Record<string, TrendProblem> = {};
  const seen = new Map<string, string>();
  for (const row of rows) {
    const month = row.month.trim();
    const price = row.price.trim();
    if (month === "" && price === "") continue;
    const found: TrendProblem = {};
    if (month === "") found.month = "missing";
    else if (seen.has(month)) found.month = "twice";
    else seen.set(month, row.id);
    const amount = Number(price.replace(/[,\s]/g, ""));
    if (price === "") found.price = "missing";
    else if (!Number.isInteger(amount)) found.price = "number";
    else if (amount < TREND_PRICE_MIN || amount > TREND_PRICE_MAX) found.price = "range";
    if (found.month || found.price) problems[row.id] = found;
  }
  return problems;
}

/** The months to send: rows with a month and a price, in the order shown. */
export function trendsToSend(
  rows: readonly PriceTrendRow[],
): { month: string; pricePerSqft: string }[] {
  return rows
    .filter((row) => row.month.trim() !== "" || row.price.trim() !== "")
    .map((row) => ({ month: row.month.trim(), pricePerSqft: row.price.trim() }));
}

/** The price trends as a saved project fills the box (newest month last, as the read gives them). */
export function trendRowsOf(project: ProjectEditView | null): PriceTrendRow[] {
  return (project?.trends ?? []).map((trend) => ({
    id: trend.month,
    month: trend.month,
    price: String(trend.pricePerSqft),
  }));
}

export type ProjectFormScope = "admin" | "builder";

/** Everything the form holds that is sent on a save. */
export interface ProjectFormState {
  values: ProjectFieldValues;
  formId: string;
  videos: string[];
  /** The paths now in each group, in order. */
  media: Record<ProjectMediaGroupName, string[]>;
  trends: PriceTrendRow[];
}

/**
 * What a save sends. A new project sends only its boxes (and, for the admin, the builder and the enquiry form):
 * media and price trends wait for the first save because the folder is named for the project's id. A save of a
 * saved project sends the media too, and the admin's also the enquiry form and the price trends.
 */
export function payloadOf(
  state: ProjectFormState,
  options: { scope: ProjectFormScope; projectId: string | null },
): Record<string, unknown> {
  const { values, formId, videos, media, trends } = state;
  const { scope, projectId } = options;
  const { builderId, ...boxes } = values;
  const payload: Record<string, unknown> = { ...boxes };
  if (scope === "admin") {
    if (projectId === null) payload.builderId = builderId;
    payload.formId = formId;
  }
  if (projectId !== null) {
    payload.projectId = projectId;
    payload.images = media.images;
    payload.floorPlans = media.floorPlans;
    payload.elevations = media.elevations;
    payload.plotImages = media.plotImages;
    payload.brochure = media.brochure[0] ?? null;
    payload.videos = videos;
    if (scope === "admin") payload.priceTrends = trendsToSend(trends);
  }
  return payload;
}
