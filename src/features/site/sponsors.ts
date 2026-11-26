import { z } from "zod";
import {
  DEFAULT_SPONSOR_STYLE,
  SPONSOR_STYLES,
  type SponsorAd,
  type SponsorCinematic,
  type SponsorCreatives,
  type SponsorImage,
  type SponsorShowcase,
  type SponsorStyle,
} from "@/lib/sponsors";
import { compactDates, PROMOTION_DAY } from "@/lib/promotion-dates";
import { publicStorageUrl } from "@/lib/storage-url";

/**
 * The sponsored banners as the site content stores them (`site_settings.sponsors`, FR-PUB-04, ADR-045),
 * and how they become what the banner area takes (`SponsorAd`). Pure: no framework, so the rules are
 * tested on their own. The pictures are files in the site's public bucket, stored as a path and a
 * size, never as a web address: the address is built here, so no banner can point a visitor's browser
 * at another site's picture. A banner that does not fit is dropped and counted, never thrown on.
 */

/** Where the banners' pictures are (public; written by the administrator only, 500 KB at most, never SVG). */
export const SPONSOR_BUCKET = "site-assets";

const PICTURE_PATH = /^[A-Za-z0-9][A-Za-z0-9._\-/]*\.(?:webp|jpe?g|png)$/i;

const imageSchema = z.object({
  path: z
    .string()
    .max(300)
    .regex(PICTURE_PATH)
    .refine((path) => !path.includes("..") && !path.includes("//")),
  width: z.number().int().positive().max(6000),
  height: z.number().int().positive().max(6000),
});

const creativesSchema = z.object({ desktop: imageSchema, compact: imageSchema });

/** A project's slug, as the projects feature keeps it (`projectPath` in src/features/projects/address.ts; a test holds them together). */
const PROJECT_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The address of one of our project pages. */
export function sponsorProjectHref(slug: string): string {
  return `/projects/${slug}`;
}

const isSecureLink = (text: string) => {
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
};

/** A line the admin typed for a Showcase or Cinematic ad: trimmed, one line, short. */
const line = (max: number) => z.string().trim().min(1).max(max);

// Every line is optional when stored: the admin may fill one style before the other. An ad takes a style's words only
// when the ones that style needs are all there (see `showcaseOf` and `cinematicOf`).
const showcaseSchema = z.object({
  project: line(60).optional(),
  locality: line(60).optional(),
  homes: line(40).optional(),
  price: line(40).optional(),
  size: line(40).optional(),
  possession: line(40).optional(),
  rera: line(60).optional(),
});

const cinematicSchema = z.object({
  eyebrow: line(30).optional(),
  headline: line(40).optional(),
  line: line(90).optional(),
  button: line(24).optional(),
});

/** The Showcase facts, when the four it needs are there. */
function showcaseOf(stored: z.infer<typeof showcaseSchema> | undefined): SponsorShowcase | null {
  if (!stored?.project || !stored.locality || !stored.homes || !stored.price) return null;
  const { project, locality, homes, price, size, possession, rera } = stored;
  return {
    project,
    locality,
    homes,
    price,
    ...(size ? { size } : {}),
    ...(possession ? { possession } : {}),
    ...(rera ? { rera } : {}),
  };
}

/** The Cinematic words, when the headline and the button are there. */
function cinematicOf(stored: z.infer<typeof cinematicSchema> | undefined): SponsorCinematic | null {
  if (!stored?.headline || !stored.button) return null;
  const { eyebrow, headline, line: sentence, button } = stored;
  return {
    headline,
    button,
    ...(eyebrow ? { eyebrow } : {}),
    ...(sentence ? { line: sentence } : {}),
  };
}

const adSchema = z
  .object({
    id: z.string().min(1).max(64),
    active: z.boolean(),
    placements: z.array(z.enum(["hero", "results"])).min(1),
    alt: z.string().trim().min(1).max(200),
    /** "url" (another site, the default for ads saved before the styles) or "project" (one of our project pages). */
    link: z.enum(["url", "project"]).optional(),
    href: z.string().max(2000).refine(isSecureLink).optional(),
    projectSlug: z.string().min(2).max(80).regex(PROJECT_SLUG).optional(),
    strip: creativesSchema.optional(),
    panel: creativesSchema.optional(),
    brand: line(60).optional(),
    photo: imageSchema.optional(),
    showcase: showcaseSchema.optional(),
    cinematic: cinematicSchema.optional(),
    /** The ad's first and last day (ADR-210); the public read leaves out an ad that is not running today. */
    startsOn: z.string().regex(PROMOTION_DAY).optional(),
    endsOn: z.string().regex(PROMOTION_DAY).optional(),
  })
  .refine((ad) => (ad.link === "project" ? ad.projectSlug !== undefined : ad.href !== undefined));

type Creatives = z.infer<typeof creativesSchema>;

/** The hero ad style the admin chose; anything else (or nothing) is the default, the Showcase. */
export function toSponsorStyle(stored: unknown): SponsorStyle {
  return SPONSOR_STYLES.find((style) => style === stored) ?? DEFAULT_SPONSOR_STYLE;
}

function toImage(supabaseUrl: string, image: z.infer<typeof imageSchema>): SponsorImage {
  return {
    src: publicStorageUrl(supabaseUrl, SPONSOR_BUCKET, image.path),
    width: image.width,
    height: image.height,
  };
}

function toCreatives(supabaseUrl: string, creatives: Creatives): SponsorCreatives {
  return {
    desktop: toImage(supabaseUrl, creatives.desktop),
    compact: toImage(supabaseUrl, creatives.compact),
  };
}

/**
 * The banners to offer the banner area, in the administrator's order. Each one is checked on its own:
 * its id (once each: the first wins), an https destination with no credentials, a description, at
 * least one placement, and pictures that are paths to webp, jpeg or png files in the bucket. Whether a
 * banner qualifies for a slot (active, the right format and shape) is the selection's job
 * (`selectSponsors`), not this one's, so an inactive banner is kept here.
 */
export function toSponsorAds(
  stored: readonly unknown[],
  supabaseUrl: string,
  log?: { warn: (message: string, context?: Record<string, unknown>) => void },
): SponsorAd[] {
  const ads: SponsorAd[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const item of stored) {
    const parsed = adSchema.safeParse(item);
    if (!parsed.success || seen.has(parsed.data.id)) {
      skipped += 1;
      continue;
    }
    seen.add(parsed.data.id);
    const { id, active, placements, alt, link, href, projectSlug, strip, panel } = parsed.data;
    const { brand, photo, showcase, cinematic, startsOn, endsOn } = parsed.data;
    const project = link === "project" && projectSlug !== undefined ? projectSlug : null;
    const facts = showcaseOf(showcase);
    const words = cinematicOf(cinematic);
    ads.push({
      id,
      active,
      placements,
      alt,
      href: project === null ? (href ?? "") : sponsorProjectHref(project),
      external: project === null,
      ...(project === null ? {} : { projectSlug: project }),
      ...(strip ? { strip: toCreatives(supabaseUrl, strip) } : {}),
      ...(panel ? { panel: toCreatives(supabaseUrl, panel) } : {}),
      ...(brand ? { brand } : {}),
      ...(photo ? { photo: toImage(supabaseUrl, photo) } : {}),
      ...(facts ? { showcase: facts } : {}),
      ...(words ? { cinematic: words } : {}),
      ...(startsOn === undefined && endsOn === undefined
        ? {}
        : { dates: compactDates({ startsOn, endsOn }) }),
    });
  }
  if (skipped > 0) log?.warn("sponsored banners skipped, they do not fit", { skipped });
  return ads;
}
