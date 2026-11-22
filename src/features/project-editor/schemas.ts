import { z } from "zod";
import {
  ACRES_MAX,
  ADDRESS_MAX,
  ADVANTAGES_MAX,
  AMENITIES_MAX,
  AREA_SQFT_MAX,
  BHK_MAX,
  BHK_MIN,
  DESCRIPTION_MAX,
  LOCALITY_MAX,
  LOCALITY_MIN,
  MEDIA_MAX,
  MEDIA_PATH_MAX,
  NAME_MAX,
  NAME_MIN,
  NEARBY_MAX,
  OFFER_TYPES,
  PRICE_MAX,
  PRICE_TYPES,
  PROJECT_STATUSES,
  PLOT_STATUSES,
  PROJECT_TYPES,
  PROPERTY_TYPES,
  RERA_NUMBER_MAX,
  RERA_REASON_MAX,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  SLUG_MAX,
  SLUG_MIN,
  SPECIFICATIONS_MAX,
  TAG_MAX,
  TREND_MONTHS_MAX,
  TREND_PRICE_MAX,
  TREND_PRICE_MIN,
  VIDEOS_MAX,
  VILLA_TYPES,
} from "./constants";
import {
  areaApplies,
  offerTypeApplies,
  plotStatusApplies,
  villaTypeApplies,
  possessionApplies,
  priceTypesFor,
  propertyTypeFits,
} from "./rules";

/**
 * What the project form sends (S7-T02, FR-ADM-03, FR-BLD-02). A schema message is a key under `validation.*`; the
 * screen looks the words up (ADR-035). Nothing here says who is asking: the admin or the builder is the session. A
 * box left empty clears an optional field on a save; on a new project it is simply not set. The builder and the
 * enquiry form can be chosen by the admin only (the database refuses anyone else too).
 */
const uuid = z.uuid({ error: "validation.invalid" }).transform((value) => value.toLowerCase());

const tidy = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/[ \t]+/g, " ") : typed;

/** A blank box is "no value" (null); anything else goes on to the rule. */
const clearable = <T extends z.ZodType>(rule: T) =>
  z
    .preprocess(
      (typed) => (typeof typed === "string" && typed.trim() === "" ? null : typed),
      rule.nullable(),
    )
    .optional();

/** "1,480", " 1480 " and 1480 are the same number; a word is NaN and fails the rule. */
const toNumber = (typed: unknown): unknown => {
  if (typeof typed !== "string") return typed;
  return Number(typed.replace(/[,\s]/g, ""));
};

/** A box left empty is missing, which is not the same as a word that is not a choice or a number. */
const blankToMissing = (typed: unknown): unknown =>
  typeof typed === "string" && typed.trim() === "" ? undefined : typed;

const choiceError = (issue: { input?: unknown }) =>
  issue.input === undefined ? "validation.required" : "validation.invalid";

/** A whole number that must be given (the price). */
const requiredWholeNumber = (min: number, max: number) =>
  z.preprocess(
    (typed) => {
      const given = blankToMissing(typed);
      return given === undefined ? undefined : toNumber(given);
    },
    z
      .number({
        error: (issue) =>
          issue.input === undefined ? "validation.required" : "validation.numberInvalid",
      })
      .refine(Number.isInteger, { error: "validation.numberInvalid" })
      .min(min, { error: "validation.invalid" })
      .max(max, { error: "validation.invalid" }),
  );

/** A number with at most `places` decimals. */
const decimal = (min: number, max: number, places: number) =>
  clearable(
    z.preprocess(
      toNumber,
      z
        .number({ error: "validation.numberInvalid" })
        .min(min, { error: "validation.invalid" })
        .max(max, { error: "validation.invalid" })
        .refine(
          (value) => {
            const factor = 10 ** places;
            return Math.round(value * factor) / factor === value;
          },
          { error: "validation.invalid" },
        ),
    ),
  );

/** One plain line of text, trimmed, up to `max` characters. */
const line = (max: number) =>
  clearable(
    z.preprocess(
      tidy,
      z
        .string({ error: "validation.invalid" })
        .max(max, { error: "validation.invalid" })
        .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
    ),
  );

/** Text of several lines (a description): the ends are trimmed and the lines kept. */
const paragraph = (max: number) =>
  clearable(
    z.preprocess(
      (typed) => (typeof typed === "string" ? typed.trim() : typed),
      z.string({ error: "validation.invalid" }).max(max, { error: "validation.invalid" }),
    ),
  );

/** A month as the month box gives it, "2026-10", kept as the first day of that month. */
const calendarMonth = clearable(
  z
    .string({ error: "validation.invalid" })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "validation.invalid" })
    .transform((month) => `${month}-01`),
);

/** A list of tags: each trimmed, empty ones dropped, repeats (ignoring case) dropped, at most `count` of them. */
const tags = (count: number) =>
  z
    .preprocess(
      (typed) => {
        if (!Array.isArray(typed)) return typed;
        const seen = new Set<string>();
        const kept: unknown[] = [];
        for (const item of typed) {
          const text = typeof item === "string" ? item.trim().replace(/[ \t]+/g, " ") : item;
          if (text === "") continue;
          const key = typeof text === "string" ? text.toLowerCase() : null;
          if (key !== null) {
            if (seen.has(key)) continue;
            seen.add(key);
          }
          kept.push(text);
        }
        return kept;
      },
      z
        .array(
          z
            .string({ error: "validation.invalid" })
            .max(TAG_MAX, { error: "validation.invalid" })
            .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
          { error: "validation.invalid" },
        )
        .max(count, { error: "validation.invalid" }),
    )
    .optional();

const name = z.preprocess(
  tidy,
  z
    .string({ error: "validation.required" })
    .min(NAME_MIN, { error: "validation.required" })
    .max(NAME_MAX, { error: "validation.invalid" })
    .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
);

/** The page address: lower case words joined by hyphens, as the database's own check. */
const slug = z.preprocess(
  (typed) => (typeof typed === "string" ? typed.trim().toLowerCase() : typed),
  z
    .string({ error: "validation.required" })
    .min(SLUG_MIN, { error: "validation.slugInvalid" })
    .max(SLUG_MAX, { error: "validation.slugInvalid" })
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, { error: "validation.slugInvalid" }),
);

const locality = z.preprocess(
  tidy,
  z
    .string({ error: "validation.required" })
    .min(LOCALITY_MIN, { error: "validation.required" })
    .max(LOCALITY_MAX, { error: "validation.invalid" })
    .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
);

/** Digits with an optional leading plus; spaces, dashes and brackets are dropped. */
const contactPhone = clearable(
  z.preprocess(
    (typed) => (typeof typed === "string" ? typed.replace(/[\s\-()]/g, "") : typed),
    z.string().regex(/^\+?[0-9]{6,15}$/, { error: "validation.phoneInvalid" }),
  ),
);

/** "true", "on" and true are yes; anything else, or nothing, is no. */
const yesNo = z.preprocess(
  (typed) => typed === true || typed === "true" || typed === "on",
  z.boolean(),
);

/** Bedrooms ticked on the form: numbers or their text, each 0 to 10, each once. */
const bhkOptions = z
  .preprocess(
    (typed) =>
      Array.isArray(typed)
        ? [...new Set(typed.map((item) => toNumber(item)))].sort(
            (first, second) => Number(first) - Number(second),
          )
        : typed,
    z
      .array(
        z
          .number({ error: "validation.numberInvalid" })
          .refine(Number.isInteger, { error: "validation.numberInvalid" })
          .min(BHK_MIN, { error: "validation.invalid" })
          .max(BHK_MAX, { error: "validation.invalid" }),
        { error: "validation.invalid" },
      )
      .max(BHK_MAX - BHK_MIN + 1, { error: "validation.invalid" }),
  )
  .optional();

/** The choices the owner made required (ADR-148): the project type, the property type, the status and the price type. */
const projectType = z.preprocess(blankToMissing, z.enum(PROJECT_TYPES, { error: choiceError }));
const propertyType = z.preprocess(blankToMissing, z.enum(PROPERTY_TYPES, { error: choiceError }));
const projectStatus = z.preprocess(
  blankToMissing,
  z.enum(PROJECT_STATUSES, { error: choiceError }),
);
const priceType = z.preprocess(blankToMissing, z.enum(PRICE_TYPES, { error: choiceError }));
/** Sale or rent: asked of a commercial project only; the rule that it is given is below. */
const offerType = clearable(z.enum(OFFER_TYPES, { error: "validation.invalid" }));

/** What a plot or a villa is (ADR-160): asked for that property type only; the rule that it is given is below. */
const plotStatus = clearable(z.enum(PLOT_STATUSES, { error: "validation.invalid" }));
const villaType = clearable(z.enum(VILLA_TYPES, { error: "validation.invalid" }));

/** The boxes of the form that both the admin and a builder fill in. */
const fieldShape = {
  name,
  slug,
  projectType,
  propertyType,
  offerType,
  plotStatus,
  villaType,
  projectStatus,
  price: requiredWholeNumber(1, PRICE_MAX),
  priceType,
  areaMinSqft: decimal(0.01, AREA_SQFT_MAX, 2),
  areaMaxSqft: decimal(0.01, AREA_SQFT_MAX, 2),
  bhkOptions,
  landAreaAcres: decimal(0, ACRES_MAX, 2),
  possessionDate: calendarMonth,
  contactPhone,
  locality,
  address: line(ADDRESS_MAX),
  latitude: decimal(-90, 90, 6),
  longitude: decimal(-180, 180, 6),
  advantages: tags(ADVANTAGES_MAX),
  nearby: tags(NEARBY_MAX),
  reraApplicable: yesNo,
  reraNumber: line(RERA_NUMBER_MAX),
  reraNotApplicableReason: paragraph(RERA_REASON_MAX),
  description: paragraph(DESCRIPTION_MAX),
  specifications: paragraph(SPECIFICATIONS_MAX),
  amenities: tags(AMENITIES_MAX),
  seoTitle: line(SEO_TITLE_MAX),
  seoDescription: paragraph(SEO_DESCRIPTION_MAX),
  /** The answers to the extra boxes the super admin defines (ADR-168), by box id; checked against the boxes on save. */
  extraFields: z.record(z.string().max(40), z.string().max(2000)).optional(),
};

type RuleInput = {
  projectType: string;
  propertyType: string;
  offerType?: string | null | undefined;
  plotStatus?: string | null | undefined;
  villaType?: string | null | undefined;
  projectStatus: string;
  priceType: string;
  areaMinSqft?: number | null | undefined;
  areaMaxSqft?: number | null | undefined;
  possessionDate?: string | null | undefined;
  reraApplicable: boolean;
  reraNumber?: string | null | undefined;
  reraNotApplicableReason?: string | null | undefined;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
};

/**
 * The rules that look at several boxes together (ADR-148); each message goes on the box that has to change. They run
 * once every box is valid on its own. What does not apply to a kind of project is not an error: it is dropped on
 * save (see `projectRowFrom`), so a box the form hid can never block a save.
 */
function crossRules(value: RuleInput, problems: z.RefinementCtx): void {
  const missing = (path: string) =>
    problems.addIssue({ code: "custom", path: [path], message: "validation.required" });

  if (!propertyTypeFits(value.projectType, value.propertyType)) {
    problems.addIssue({ code: "custom", path: ["propertyType"], message: "validation.invalid" });
  }
  if (offerTypeApplies(value.projectType) && value.offerType == null) missing("offerType");
  if (plotStatusApplies(value.propertyType) && value.plotStatus == null) missing("plotStatus");
  if (villaTypeApplies(value.propertyType) && value.villaType == null) missing("villaType");
  if (!priceTypesFor(value.projectType, value.offerType ?? "").includes(value.priceType)) {
    problems.addIssue({ code: "custom", path: ["priceType"], message: "validation.invalid" });
  }
  if (areaApplies(value.projectType, value.propertyType)) {
    if (value.areaMinSqft == null) missing("areaMinSqft");
    if (value.areaMaxSqft == null) missing("areaMaxSqft");
    if (
      value.areaMinSqft != null &&
      value.areaMaxSqft != null &&
      value.areaMinSqft > value.areaMaxSqft
    ) {
      problems.addIssue({ code: "custom", path: ["areaMaxSqft"], message: "validation.areaRange" });
    }
  }
  if (possessionApplies(value.projectStatus) && value.possessionDate == null) {
    missing("possessionDate");
  }
  if (value.reraApplicable) {
    if (value.reraNumber == null) missing("reraNumber");
  } else if (value.reraNotApplicableReason == null) {
    missing("reraNotApplicableReason");
  }
  if ((value.latitude == null) !== (value.longitude == null)) {
    problems.addIssue({
      code: "custom",
      path: [value.latitude == null ? "latitude" : "longitude"],
      message: "validation.coordinatesTogether",
    });
  }
}

/** A file of the project's own: `<project id>/<file name>` in the project-media bucket, nothing else. */
const mediaPath = z
  .string({ error: "validation.invalid" })
  .max(MEDIA_PATH_MAX, { error: "validation.invalid" })
  .regex(/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\/[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/, {
    error: "validation.invalid",
  });

const mediaList = z
  .array(mediaPath, { error: "validation.invalid" })
  .max(MEDIA_MAX, { error: "validation.invalid" })
  .optional();

/** An https link to a video. */
const videoLink = z
  .string({ error: "validation.linkInvalid" })
  .trim()
  .max(MEDIA_PATH_MAX, { error: "validation.linkInvalid" })
  .refine(
    (value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    },
    { error: "validation.linkInvalid" },
  );

const videos = z
  .preprocess(
    (typed) =>
      Array.isArray(typed)
        ? typed
            .map((item) => (typeof item === "string" ? item.trim() : item))
            .filter((item) => item !== "")
        : typed,
    z
      .array(videoLink, { error: "validation.linkInvalid" })
      .max(VIDEOS_MAX, { error: "validation.invalid" }),
  )
  .optional();

const mediaShape = {
  images: mediaList,
  floorPlans: mediaList,
  elevations: mediaList,
  plotImages: mediaList,
  videos,
  brochure: clearable(mediaPath),
};

type MediaInput = {
  images?: string[] | undefined;
  floorPlans?: string[] | undefined;
  elevations?: string[] | undefined;
  plotImages?: string[] | undefined;
  brochure?: string | null | undefined;
};

/** Every file named must live in this project's own folder. */
function ownFolder(value: MediaInput & { projectId: string }, problems: z.RefinementCtx): void {
  const prefix = `${value.projectId}/`;
  const groups = {
    images: value.images,
    floorPlans: value.floorPlans,
    elevations: value.elevations,
    plotImages: value.plotImages,
    brochure: value.brochure ? [value.brochure] : [],
  };
  for (const [group, paths] of Object.entries(groups)) {
    if (paths?.some((path) => !path.startsWith(prefix))) {
      problems.addIssue({ code: "custom", path: [group], message: "validation.invalid" });
    }
  }
}

/** One month of the price trends: "2026-10" and the price per square foot. */
const trend = z.object({
  month: z
    .string({ error: "validation.invalid" })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, { error: "validation.invalid" }),
  pricePerSqft: z.preprocess(
    toNumber,
    z
      .number({ error: "validation.numberInvalid" })
      .refine(Number.isInteger, { error: "validation.numberInvalid" })
      .min(TREND_PRICE_MIN, { error: "validation.invalid" })
      .max(TREND_PRICE_MAX, { error: "validation.invalid" }),
  ),
});

const priceTrends = z
  .array(trend, { error: "validation.invalid" })
  .max(TREND_MONTHS_MAX, { error: "validation.invalid" })
  .refine((rows) => new Set(rows.map((row) => row.month)).size === rows.length, {
    error: "validation.invalid",
  })
  .optional();

/** The admin chooses which form buyers see on the project page; none (blank) means the standard one. */
const formId = z
  .preprocess(
    (typed) => (typeof typed === "string" && typed.trim() === "" ? null : typed),
    uuid.nullable(),
  )
  .optional();

/** A new project made by the admin, for the builder they name. Media and price trends come after the first save. */
export const createProjectSchema = z
  .object({ builderId: uuid, formId, ...fieldShape })
  .superRefine(crossRules);
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

/** A new project made by a builder: for themselves, so no builder is named. */
export const createMyProjectSchema = z.object({ ...fieldShape }).superRefine(crossRules);
export type CreateMyProjectInput = z.infer<typeof createMyProjectSchema>;

/** The admin saves a project: its boxes, its media, the enquiry form and the price trends. */
export const updateProjectSchema = z
  .object({ projectId: uuid, formId, priceTrends, ...fieldShape, ...mediaShape })
  .superRefine(crossRules)
  .superRefine(ownFolder);
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/** A builder saves one of their projects: its boxes and its media (not the enquiry form or the price trends). */
export const updateMyProjectSchema = z
  .object({ projectId: uuid, ...fieldShape, ...mediaShape })
  .superRefine(crossRules)
  .superRefine(ownFolder);
export type UpdateMyProjectInput = z.infer<typeof updateMyProjectSchema>;

/** The project to open on the edit page. */
export const projectIdSchema = z.object({ projectId: uuid });
