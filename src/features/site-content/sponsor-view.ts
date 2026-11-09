import { z } from "zod";
import { SPONSOR_BUCKET } from "@/features/site";
import { publicStorageUrl } from "@/lib/storage-url";
import type { SponsorImageType } from "./sponsor-rules";

/**
 * The stored sponsors as the editor shows them (S7-T11, FR-ADM-11). Read tolerantly: a sponsor the editor cannot
 * understand is left out and counted, never thrown on, so one bad entry cannot lock the admin out of the screen. A
 * sponsor saved before the editor existed (no advertiser name, no file weights) opens with an empty name and no weight
 * on its pictures. Pure: no framework, so the rules are tested on their own.
 */

export interface SponsorPictureView {
  path: string;
  /** The address of the picture, built from our own storage for the preview. */
  url: string;
  width: number;
  height: number;
  /** Not known for a picture stored before the editor measured files. */
  bytes: number | null;
  type: SponsorImageType;
}

export interface SponsorCreativesView {
  desktop: SponsorPictureView;
  compact: SponsorPictureView;
}

export interface SponsorEditView {
  id: string;
  advertiser: string;
  active: boolean;
  alt: string;
  href: string;
  strip?: SponsorCreativesView;
  panel?: SponsorCreativesView;
}

const picture = z.object({
  path: z.string().min(1).max(300),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().nonnegative().optional(),
});

const creatives = z.object({ desktop: picture, compact: picture });

const stored = z.object({
  id: z.string().min(1).max(64),
  advertiser: z.string().max(200).optional(),
  active: z.boolean(),
  alt: z.string().max(500),
  href: z.string().max(2000),
  strip: creatives.optional(),
  panel: creatives.optional(),
});

function typeOf(path: string): SponsorImageType {
  const ending = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  if (ending === "png") return "image/png";
  if (ending === "webp") return "image/webp";
  return "image/jpeg";
}

export function sponsorEditViewsOf(
  ads: readonly unknown[],
  supabaseUrl: string,
): { sponsors: SponsorEditView[]; skipped: number } {
  const sponsors: SponsorEditView[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  const view = (source: z.infer<typeof picture>): SponsorPictureView => ({
    path: source.path,
    url: publicStorageUrl(supabaseUrl, SPONSOR_BUCKET, source.path),
    width: source.width,
    height: source.height,
    bytes: source.bytes ?? null,
    type: typeOf(source.path),
  });
  const pair = (source: z.infer<typeof creatives>): SponsorCreativesView => ({
    desktop: view(source.desktop),
    compact: view(source.compact),
  });
  for (const ad of ads) {
    const parsed = stored.safeParse(ad);
    if (!parsed.success || seen.has(parsed.data.id)) {
      skipped += 1;
      continue;
    }
    seen.add(parsed.data.id);
    const { id, advertiser, active, alt, href, strip, panel } = parsed.data;
    sponsors.push({
      id,
      advertiser: advertiser ?? "",
      active,
      alt,
      href,
      ...(strip ? { strip: pair(strip) } : {}),
      ...(panel ? { panel: pair(panel) } : {}),
    });
  }
  return { sponsors, skipped };
}
