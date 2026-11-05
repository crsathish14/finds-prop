import { z } from "zod";
import type { SponsorAd, SponsorCreatives, SponsorImage } from "@/lib/sponsors";
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

const adSchema = z.object({
  id: z.string().min(1).max(64),
  active: z.boolean(),
  placements: z.array(z.enum(["hero", "results"])).min(1),
  alt: z.string().trim().min(1).max(200),
  href: z
    .string()
    .max(2000)
    .refine((text) => {
      try {
        const url = new URL(text);
        return url.protocol === "https:" && url.username === "" && url.password === "";
      } catch {
        return false;
      }
    }),
  strip: creativesSchema.optional(),
  panel: creativesSchema.optional(),
});

type Creatives = z.infer<typeof creativesSchema>;

function toImage(supabaseUrl: string, image: Creatives["desktop"]): SponsorImage {
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
    const { id, active, placements, alt, href, strip, panel } = parsed.data;
    ads.push({
      id,
      active,
      placements,
      alt,
      href,
      ...(strip ? { strip: toCreatives(supabaseUrl, strip) } : {}),
      ...(panel ? { panel: toCreatives(supabaseUrl, panel) } : {}),
    });
  }
  if (skipped > 0) log?.warn("sponsored banners skipped, they do not fit", { skipped });
  return ads;
}
