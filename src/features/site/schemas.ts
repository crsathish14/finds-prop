import { z } from "zod";

/**
 * What the site content (CMS) may hold in `site_settings` (plan 06 section 6.6, BR-80 to BR-82).
 * These shapes carry no defaults: the defaults live in code (defaults.ts) and a stored value is
 * merged over them, so a missing field means "use the default", never "empty".
 *
 * `site_settings` is public to read, so nothing private may ever be stored in it.
 */

// A link is a path on this site or an https address; anything else (javascript:, data:, //host)
// is refused, because these values end up in anchors on every page.
const linkTarget = z
  .string()
  .max(2000)
  .refine((value) => /^\/(?!\/|\\)/.test(value) || /^https:\/\/[^\s]+$/.test(value), {
    message: "A link must be a path on this site or an https address.",
  });

const navigationLink = z.object({ label: z.string().min(1).max(60), href: linkTarget });

const headerSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  links: z.array(navigationLink).max(12),
  cta: navigationLink.optional(),
});

const footerSchema = z.object({
  about: z.string().max(400).optional(),
  contact: z
    .object({
      address: z.string().max(200).optional(),
      email: z.email().optional(),
      phone: z.string().max(30).optional(),
    })
    .optional(),
  links: z.array(navigationLink).max(20),
  copyright: z.string().max(200).optional(),
});

const heroSchema = z.object({
  eyebrow: z.string().max(80).optional(),
  title: z.string().min(1).max(120).optional(),
  subtitle: z.string().max(240).optional(),
  layout: z.enum(["search_desk", "split"]),
});

const locality = z.object({
  label: z.string().min(1).max(60),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radiusKm: z.number().positive().max(100),
});

const homepageSchema = z.object({
  showFeatured: z.boolean(),
  showProjectTypes: z.boolean(),
  showDiscovery: z.boolean(),
  showWhyUs: z.boolean(),
  showCta: z.boolean(),
  localities: z.array(locality).max(30),
});

const regionSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  copyShort: z.string().min(1).max(120).optional(),
  bounds: z.object({
    south: z.number().min(-90).max(90),
    west: z.number().min(-180).max(180),
    north: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
  }),
});

/**
 * The sponsored banners (FR-PUB-04, ADR-045). The list is checked one banner at a time when it is read
 * (`toSponsorAds`), so one unusable banner never takes the others down: here it only has to be a list.
 */
const sponsorsSchema = z.object({
  ads: z.array(z.unknown()).max(30),
});

/**
 * Which of the optional content modules (Blog, FAQ, Careers) are switched on (ADR-143, FR-ADM-16). A module that is off
 * answers 404 on its public pages and leaves the menus, the sitemap and the AI assistant, while its admin pages keep working.
 */
const contentModulesSchema = z.object({
  blog: z.boolean(),
  faq: z.boolean(),
  careers: z.boolean(),
});

/**
 * The two disclaimers the super admin writes (ADR-152): one in the footer of every public page, one on the AI search
 * page. Plain text; a missing or empty one means nothing is shown (there is no built-in wording).
 */
export const DISCLAIMER_MAX = 600;
const disclaimersSchema = z.object({
  footer: z.string().max(DISCLAIMER_MAX).optional(),
  aiSearch: z.string().max(DISCLAIMER_MAX).optional(),
});

/**
 * The extra text boxes the super admin adds to the builder's project form (ADR-168). At most ten, each with a label,
 * an optional hint, a required switch, the property types it applies to (none chosen means all) and an on switch. The
 * id is the key the answers are stored under on each project, so it never changes once made.
 */
export const PROJECT_FIELDS_MAX = 10;
export const PROJECT_FIELD_LABEL_MAX = 60;
export const PROJECT_FIELD_HINT_MAX = 200;
export const PROJECT_FIELD_VALUE_MAX = 500;
export const PROJECT_FIELD_ID = /^[a-z0-9][a-z0-9-]{5,39}$/;
/** The property types a box can be limited to (the same list as the project form's; a test keeps them equal). */
export const PROJECT_FIELD_PROPERTY_TYPES = [
  "apartment",
  "villa",
  "plot",
  "vacant_land",
  "flat",
  "office",
  "co_working",
] as const;
const projectFieldSchema = z.object({
  id: z.string().regex(PROJECT_FIELD_ID),
  label: z.string().min(1).max(PROJECT_FIELD_LABEL_MAX),
  hint: z.string().max(PROJECT_FIELD_HINT_MAX).optional(),
  required: z.boolean(),
  appliesTo: z.array(z.enum(PROJECT_FIELD_PROPERTY_TYPES)).max(PROJECT_FIELD_PROPERTY_TYPES.length),
  on: z.boolean(),
});
const projectFieldsSchema = z.object({
  fields: z.array(projectFieldSchema).max(PROJECT_FIELDS_MAX),
});

export const SITE_SETTING_SCHEMAS = {
  header: headerSchema,
  footer: footerSchema,
  hero: heroSchema,
  homepage: homepageSchema,
  region: regionSchema,
  sponsors: sponsorsSchema,
  content_modules: contentModulesSchema,
  disclaimers: disclaimersSchema,
  project_fields: projectFieldsSchema,
} as const;

export type SiteSettingKey = keyof typeof SITE_SETTING_SCHEMAS;

export type SiteSettings = { [Key in SiteSettingKey]: z.infer<(typeof SITE_SETTING_SCHEMAS)[Key]> };

export const SITE_SETTING_KEYS = Object.keys(SITE_SETTING_SCHEMAS) as SiteSettingKey[];
