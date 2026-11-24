import { z } from "zod";
import { SPONSORED_BUILDERS_MAX } from "@/lib/sponsored-builders";
import { HOME_SECTION_KEYS } from "@/lib/home-sections";
import { TOP_DEVELOPERS_MAX } from "@/lib/top-developers";
import {
  FOOTER_ABOUT_MAX,
  FOOTER_ADDRESS_MAX,
  DISCLAIMER_MAX,
  FOOTER_COPYRIGHT_MAX,
  FOOTER_COMPANY_LINKS_MAX,
  FOOTER_LINKS_MAX,
  FOOTER_PHONE_MAX,
  HEADER_LINKS_MAX,
  HERO_EYEBROW_MAX,
  HERO_LAYOUTS,
  HERO_SUBTITLE_MAX,
  HERO_TITLE_MAX,
  LINK_LABEL_MAX,
  LINK_TARGET_MAX,
  LOCALITIES_MAX,
  LOCALITY_LABEL_MAX,
  LOCALITY_RADIUS_MAX_KM,
  PROJECT_FIELDS_MAX,
  PROJECT_FIELD_ID,
  PROJECT_FIELD_PROPERTY_TYPES,
  PROJECT_FIELD_HINT_MAX,
  PROJECT_FIELD_LABEL_MAX,
  SITE_NAME_MAX,
} from "./constants";

/**
 * What the four Site content pages send (S7-T10, FR-ADM-10). A schema message is a key under `validation.*`; the
 * screen looks the words up (ADR-035). Nothing here says who is asking: the admin is the session. A box left empty
 * clears an optional field, so the default shows again (BR-81). The saved value is built from these in
 * `content-service.ts` and checked once more against the shapes the public side reads.
 */
export const tidy = (typed: unknown): unknown =>
  typeof typed === "string" ? typed.trim().replace(/[ \t]+/g, " ") : typed;

const isBlank = (typed: unknown): boolean =>
  typed === undefined || typed === null || (typeof typed === "string" && typed.trim() === "");

/** A blank box is "no value" (null); anything else goes on to the rule. */
const clearable = <T extends z.ZodType>(rule: T) =>
  z.preprocess((typed) => (isBlank(typed) ? null : typed), rule.nullable()).optional();

/** One plain line of text, trimmed. Too long says how long it may be. */
const text = (max: number) =>
  z.preprocess(
    tidy,
    z
      .string()
      .max(max)
      .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
  );

export const optionalLine = (max: number) => clearable(text(max));

export const requiredLine = (max: number) =>
  z.preprocess(
    tidy,
    z
      .string()
      .min(1, { error: "validation.required", abort: true })
      .max(max)
      .regex(/^[^\p{C}]*$/u, { error: "validation.invalid" }),
  );

/** Several lines (the footer's about text): the ends are trimmed and the lines kept. */
const optionalParagraph = (max: number) =>
  clearable(
    z.preprocess(
      (typed) => (typeof typed === "string" ? typed.trim() : typed),
      z.string().max(max),
    ),
  );

/**
 * Where a link goes: a page on this site (starting with one slash) or a full https address with something after the
 * slashes. Anything else, such as `javascript:`, `data:` or `//host`, is refused because these values end up in links
 * on every page.
 */
const LINK_TARGET = /^(\/(?![/\\])|https:\/\/[^\s\p{C}])[^\s\p{C}]*$/u;

const linkTarget = z.preprocess(
  tidy,
  z
    .string()
    .min(1, { error: "validation.required", abort: true })
    .max(LINK_TARGET_MAX, { error: "validation.linkTarget" })
    .regex(LINK_TARGET, { error: "validation.linkTarget" }),
);

const navigationLink = z.object({
  label: requiredLine(LINK_LABEL_MAX),
  href: linkTarget,
});

/** The header's button: both boxes empty means no button; one of them empty is a mistake. */
const optionalLink = z
  .preprocess((typed) => {
    if (typeof typed === "object" && typed !== null) {
      const { label, href } = typed as Record<string, unknown>;
      if (isBlank(label) && isBlank(href)) return null;
    }
    return typed;
  }, navigationLink.nullable())
  .optional();

export const headerInputSchema = z.object({
  name: optionalLine(SITE_NAME_MAX),
  links: z.array(navigationLink).max(HEADER_LINKS_MAX),
  cta: optionalLink,
});
export type HeaderInput = z.infer<typeof headerInputSchema>;

export const footerInputSchema = z.object({
  about: optionalParagraph(FOOTER_ABOUT_MAX),
  contact: z
    .object({
      address: optionalLine(FOOTER_ADDRESS_MAX),
      email: clearable(z.preprocess(tidy, z.email({ error: "validation.emailInvalid" }))),
      phone: optionalLine(FOOTER_PHONE_MAX),
    })
    .optional(),
  links: z.array(navigationLink).max(FOOTER_LINKS_MAX),
  companyLinks: z.array(navigationLink).max(FOOTER_COMPANY_LINKS_MAX).default([]),
  copyright: optionalLine(FOOTER_COPYRIGHT_MAX),
});
export type FooterInput = z.infer<typeof footerInputSchema>;

/**
 * One disclaimer (ADR-152): plain text, up to a few short paragraphs. Line breaks are kept (a Windows line break counts
 * as one), every other control character is refused, and a blank box means "no disclaimer".
 */
const disclaimerText = clearable(
  z.preprocess(
    (typed) => (typeof typed === "string" ? typed.replace(/\r\n?/g, "\n").trim() : typed),
    z
      .string()
      .max(DISCLAIMER_MAX)
      .regex(/^(?:[^\p{C}]|\n)*$/u, { error: "validation.invalid" }),
  ),
);

export const disclaimersInputSchema = z.object({
  footer: disclaimerText,
  aiSearch: disclaimerText,
});
export type DisclaimersInput = z.infer<typeof disclaimersInputSchema>;

/**
 * The extra project form boxes (ADR-168). The whole list is saved at once, in the order the builder sees it. A label is
 * needed, a hint is optional, two boxes may not share a label (a builder could not tell them apart) or an id (the
 * answers are stored under it), and no more than ten are kept, on or off.
 */
const projectFieldInput = z.object({
  id: z.string().regex(PROJECT_FIELD_ID, { error: "validation.invalid" }),
  label: requiredLine(PROJECT_FIELD_LABEL_MAX),
  hint: optionalLine(PROJECT_FIELD_HINT_MAX),
  required: z.boolean(),
  appliesTo: z.array(z.enum(PROJECT_FIELD_PROPERTY_TYPES)),
  on: z.boolean(),
});

export const projectFieldsInputSchema = z
  .object({ fields: z.array(projectFieldInput).max(PROJECT_FIELDS_MAX) })
  .superRefine((value, context) => {
    const ids = new Set<string>();
    const labels = new Set<string>();
    value.fields.forEach((field, index) => {
      if (ids.has(field.id)) {
        context.addIssue({
          code: "custom",
          path: ["fields", index, "label"],
          message: "validation.invalid",
        });
      }
      ids.add(field.id);
      const same = field.label.toLowerCase();
      if (labels.has(same)) {
        context.addIssue({
          code: "custom",
          path: ["fields", index, "label"],
          message: "validation.duplicate",
        });
      }
      labels.add(same);
    });
  });
export type ProjectFieldsInput = z.infer<typeof projectFieldsInputSchema>;

export const heroInputSchema = z.object({
  eyebrow: optionalLine(HERO_EYEBROW_MAX),
  title: requiredLine(HERO_TITLE_MAX),
  subtitle: optionalLine(HERO_SUBTITLE_MAX),
  layout: z.enum(HERO_LAYOUTS, { error: "validation.invalid" }),
});
export type HeroInput = z.infer<typeof heroInputSchema>;

/** "13.0067", " 13.0067 " and 13.0067 are the same number; a blank box is missing, a word is not a number. */
const toNumber = (typed: unknown): unknown => {
  if (typeof typed !== "string") return typed;
  return typed.trim() === "" ? undefined : Number(typed.trim());
};

const numberError = (issue: { input?: unknown }): string =>
  issue.input === undefined ? "validation.required" : "validation.numberInvalid";

/** Six decimals is about a tenth of a metre, more than a search radius of kilometres needs. */
const coordinate = (limit: number) =>
  z
    .preprocess(
      toNumber,
      z
        .number({ error: numberError })
        .min(-limit, { error: "validation.invalid" })
        .max(limit, { error: "validation.invalid" }),
    )
    .transform((value) => Math.round(value * 1e6) / 1e6);

const localityRow = z.object({
  label: requiredLine(LOCALITY_LABEL_MAX),
  lat: coordinate(90),
  lng: coordinate(180),
  radiusKm: z.preprocess(
    toNumber,
    z
      .number({ error: numberError })
      .gt(0, { error: "validation.invalid" })
      .max(LOCALITY_RADIUS_MAX_KM, { error: "validation.invalid" }),
  ),
});

/** The section order: every home section exactly once (a save always sends the whole list). */
const sectionOrder = z
  .array(z.enum(HOME_SECTION_KEYS, { error: "validation.invalid" }))
  .length(HOME_SECTION_KEYS.length, { error: "validation.invalid" })
  .refine((keys) => new Set(keys).size === keys.length, { error: "validation.invalid" });

export const homepageInputSchema = z.object({
  showFeatured: z.boolean({ error: "validation.invalid" }),
  showProjectTypes: z.boolean({ error: "validation.invalid" }),
  showDiscovery: z.boolean({ error: "validation.invalid" }),
  showWhyUs: z.boolean({ error: "validation.invalid" }),
  showCta: z.boolean({ error: "validation.invalid" }),
  order: sectionOrder.optional(),
  localities: z
    .array(localityRow)
    .max(LOCALITIES_MAX)
    .superRefine((rows, context) => {
      const seen = new Set<string>();
      rows.forEach((row, index) => {
        const same = row.label.toLowerCase();
        if (seen.has(same)) {
          context.addIssue({
            code: "custom",
            message: "validation.localityLabelTaken",
            path: [index, "label"],
          });
        }
        seen.add(same);
      });
    }),
});
export type HomepageInput = z.infer<typeof homepageInputSchema>;

/**
 * The three switches of the content modules (ADR-143, FR-ADM-16): all three are sent together, so a save replaces the
 * whole setting and repeating it changes nothing more.
 */
export const contentModulesInputSchema = z.object({
  blog: z.boolean({ error: "validation.invalid" }),
  faq: z.boolean({ error: "validation.invalid" }),
  careers: z.boolean({ error: "validation.invalid" }),
});
export type ContentModulesInput = z.infer<typeof contentModulesInputSchema>;

/** The chosen developers of the home page, in order: at most 10, each once, each a real id. The whole list is sent. */
export const topDevelopersInputSchema = z.object({
  builderIds: z
    .array(z.uuid({ error: "validation.invalid" }))
    .max(TOP_DEVELOPERS_MAX, { error: "validation.invalid" })
    .refine((ids) => new Set(ids).size === ids.length, { error: "validation.invalid" }),
});
export type TopDevelopersInput = z.infer<typeof topDevelopersInputSchema>;

/** One sponsored slot's builders and agents: at most 10, each once, each a real id. */
const sponsoredList = z
  .array(z.uuid({ error: "validation.invalid" }))
  .max(SPONSORED_BUILDERS_MAX, { error: "validation.invalid" })
  .refine((ids) => new Set(ids).size === ids.length, { error: "validation.invalid" });

/** The builders and agents picked for the Featured card and the Developer Spotlight (ADR-191). Both lists are sent. */
export const sponsoredBuildersInputSchema = z.object({
  featured: sponsoredList,
  spotlight: sponsoredList,
});
export type SponsoredBuildersInput = z.infer<typeof sponsoredBuildersInputSchema>;
