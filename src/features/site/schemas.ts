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
    .object({ email: z.email().optional(), phone: z.string().max(30).optional() })
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

export const SITE_SETTING_SCHEMAS = {
  header: headerSchema,
  footer: footerSchema,
  hero: heroSchema,
  homepage: homepageSchema,
  region: regionSchema,
} as const;

export type SiteSettingKey = keyof typeof SITE_SETTING_SCHEMAS;

export type SiteSettings = { [Key in SiteSettingKey]: z.infer<(typeof SITE_SETTING_SCHEMAS)[Key]> };

export const SITE_SETTING_KEYS = Object.keys(SITE_SETTING_SCHEMAS) as SiteSettingKey[];
