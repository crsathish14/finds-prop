import { SITE_SETTING_SCHEMAS, toSponsorAds, toSponsorStyle } from "@/features/site";
import { checkPictureClean } from "@/lib/image-hidden-data";
import type { SponsorStyle } from "@/lib/sponsors";
import { ActionError } from "@/server/actions/normalise-error";
import { SPONSOR_IMAGE_MAX_KB, SPONSOR_PHOTO_MAX_KB } from "./constants";
import {
  PHOTO_RULE,
  SLOT_SIZES,
  SPONSOR_SLOTS,
  photoProblem,
  readImageInfo,
  slotProblem,
  type SlotProblem,
  type SponsorSlot,
} from "./sponsor-rules";
import type { SponsorsInput } from "./sponsor-schemas";

/**
 * The rules of saving the sponsors (S7-T11, FR-ADM-11), apart from the code that reaches the database and the bucket, so
 * they can be tested with a stand-in. The real store is in `sponsors.server.ts`: it acts as the signed-in admin, so the
 * policies of `site_settings` and of the `site-assets` bucket decide what is allowed (only the super admin writes either).
 * The action has already checked the caller is the super admin and counted the rate limit.
 *
 * The browser puts the pictures in the bucket first and sends their paths. Nothing it says about a file is believed:
 * each new file is read back from the bucket here, its type, weight and pixel size are worked out from its own bytes,
 * and the slot rules decide. The setting is written only when every picture passes, and the files that no sponsor
 * uses any more are taken out of the bucket afterwards (a failure there is logged, never raised: the setting is
 * already right and the files are not referenced).
 */

/** A stored picture: where it is and what the server measured. */
export interface StoredPicture {
  path: string;
  width: number;
  height: number;
  bytes: number;
}

/** Calls made as the signed-in admin. */
export interface SponsorStore {
  /** The sponsors as stored now (whatever is there, unchecked). */
  readAds(): Promise<unknown[]>;
  /** The hero ad style as stored now (unchecked), or nothing. */
  readStyle(): Promise<unknown>;
  /** True when a project with this slug is live on the site (approved and published). */
  isLiveProject(slug: string): Promise<boolean>;
  /** A file of the bucket, or `null` when there is none (or it cannot be read). */
  fetchImage(path: string): Promise<Uint8Array | null>;
  /** Replaces the whole list and the style. Throws the database's failure through `ActionError`. */
  write(ads: Record<string, unknown>[], style: SponsorStyle): Promise<void>;
  /** Takes files out of the bucket. */
  removeFiles(paths: readonly string[]): Promise<void>;
}

export interface SponsorsDone {
  count: number;
  active: number;
}

interface Logger {
  warn: (message: string, context?: Record<string, unknown>) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Every stored picture the current list knows, with its measures, so an unchanged picture is not read again. */
function knownPictures(ads: readonly unknown[]): {
  known: Map<string, StoredPicture>;
  paths: Set<string>;
} {
  const known = new Map<string, StoredPicture>();
  const paths = new Set<string>();
  for (const ad of ads) {
    if (!isRecord(ad)) continue;
    const photo = ad.photo;
    if (isRecord(photo) && typeof photo.path === "string") {
      paths.add(photo.path);
      const { path, width, height, bytes } = photo;
      if (typeof width === "number" && typeof height === "number" && typeof bytes === "number") {
        known.set(path, { path, width, height, bytes });
      }
    }
    for (const name of ["strip", "panel"] as const) {
      const creatives = ad[name];
      if (!isRecord(creatives)) continue;
      for (const device of ["desktop", "compact"] as const) {
        const picture = creatives[device];
        if (!isRecord(picture) || typeof picture.path !== "string") continue;
        paths.add(picture.path);
        const { path, width, height, bytes } = picture;
        if (typeof width === "number" && typeof height === "number" && typeof bytes === "number") {
          known.set(path, { path, width, height, bytes });
        }
      }
    }
  }
  return { known, paths };
}

const PROBLEM_KEY: Record<SlotProblem, string> = {
  type: "validation.sponsorImageType",
  size: "validation.sponsorImageSize",
  small: "validation.sponsorImageSmall",
  shape: "validation.sponsorImageShape",
};

/** What a new picture is for: one of the four banner slots, or the Showcase and Cinematic photo (ADR-182). */
type PictureUse = SponsorSlot | "photo";

/** Reads one new picture back from the bucket and checks it for its use. */
async function inspect(
  store: SponsorStore,
  path: string,
  use: PictureUse,
): Promise<
  { picture: StoredPicture } | { problem: { key: string; values?: Record<string, number> } }
> {
  const bytes = await store.fetchImage(path);
  if (!bytes) return { problem: { key: "validation.sponsorImageMissing" } };
  const info = readImageInfo(bytes);
  const problem =
    use === "photo"
      ? photoProblem(info, bytes.byteLength)
      : slotProblem(use, info, bytes.byteLength);
  if (problem === null && info) {
    // The browser takes the hidden data out before it sends a picture; one that still has some did not come through the page.
    const clean = checkPictureClean(bytes);
    if (clean === "hidden") return { problem: { key: "validation.sponsorImageHidden" } };
    if (clean === "broken") return { problem: { key: PROBLEM_KEY.type } };
    return { picture: { path, width: info.width, height: info.height, bytes: bytes.byteLength } };
  }
  const minimum = use === "photo" ? PHOTO_RULE.minimum : SLOT_SIZES[use.format][use.device].minimum;
  const values =
    problem === "size"
      ? { maximum: use === "photo" ? SPONSOR_PHOTO_MAX_KB : SPONSOR_IMAGE_MAX_KB }
      : problem === "small"
        ? { width: minimum.width, height: minimum.height }
        : undefined;
  return { problem: { key: PROBLEM_KEY[problem ?? "type"], ...(values ? { values } : {}) } };
}

/** The lines of a style that were filled in, or nothing when none was. */
function filledLines(
  lines: Record<string, string | null | undefined> | undefined,
): Record<string, string> | undefined {
  if (!lines) return undefined;
  const filled = Object.fromEntries(
    Object.entries(lines).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
  return Object.keys(filled).length > 0 ? filled : undefined;
}

export async function saveSponsorsContent(
  store: SponsorStore,
  input: SponsorsInput,
  log?: Logger,
): Promise<SponsorsDone> {
  const before = knownPictures(await store.readAds());
  // Left out, the stored style is kept: a save from an older screen must not reset the admin's choice.
  const style = input.style ?? toSponsorStyle(await store.readStyle());

  // The new files (those the stored list does not already hold), each read back once.
  const wanted = new Map<string, PictureUse>();
  input.sponsors.forEach((sponsor) => {
    if (sponsor.photo !== undefined && !before.known.has(sponsor.photo)) {
      wanted.set(sponsor.photo, "photo");
    }
    for (const slot of SPONSOR_SLOTS) {
      const path = sponsor[slot.format]?.[slot.device];
      if (path !== undefined && !before.known.has(path) && !wanted.has(path)) {
        wanted.set(path, slot);
      }
    }
  });
  const checked = new Map(
    await Promise.all(
      [...wanted].map(async ([path, slot]) => [path, await inspect(store, path, slot)] as const),
    ),
  );

  const fieldErrors: Record<string, { key: string; values?: Record<string, number> }[]> = {};
  const pictureAt = (path: string): StoredPicture | undefined => {
    const stored = before.known.get(path);
    if (stored) return stored;
    const result = checked.get(path);
    return result && "picture" in result ? result.picture : undefined;
  };

  // A sponsor that links to one of our projects must name one that buyers can open.
  const projects = [
    ...new Set(
      input.sponsors.flatMap((sponsor) =>
        sponsor.link === "project" && sponsor.projectSlug ? [sponsor.projectSlug] : [],
      ),
    ),
  ];
  const live = new Map(
    await Promise.all(
      projects.map(async (slug) => [slug, await store.isLiveProject(slug)] as const),
    ),
  );

  const ads = input.sponsors.map((sponsor, index) => {
    const value: Record<string, unknown> = {
      id: sponsor.id,
      advertiser: sponsor.advertiser,
      active: sponsor.active,
      // The screen has no placement control: every sponsor is eligible for the hero and for results, and each slot
      // keeps its own rule (results use the strip, the hero follows the layout).
      placements: ["hero", "results"],
      alt: sponsor.alt,
      link: sponsor.link,
    };
    if (sponsor.link === "project" && sponsor.projectSlug) {
      value.projectSlug = sponsor.projectSlug;
      if (!live.get(sponsor.projectSlug)) {
        fieldErrors[`sponsors.${index}.projectSlug`] = [
          { key: "validation.sponsorProjectMissing" },
        ];
      }
    } else {
      value.href = sponsor.href;
    }
    if (sponsor.brand) value.brand = sponsor.brand;
    const showcase = filledLines(sponsor.showcase);
    if (showcase) value.showcase = showcase;
    const cinematic = filledLines(sponsor.cinematic);
    if (cinematic) value.cinematic = cinematic;
    if (sponsor.photo !== undefined) {
      const picture = pictureAt(sponsor.photo);
      if (picture) {
        value.photo = picture;
      } else {
        const result = checked.get(sponsor.photo);
        if (result && "problem" in result) {
          fieldErrors[`sponsors.${index}.photo`] = [result.problem];
        }
      }
    }
    for (const name of ["strip", "panel"] as const) {
      const chosen = sponsor[name];
      if (!chosen?.desktop || !chosen.compact) continue;
      const creatives: Record<string, StoredPicture> = {};
      for (const slot of SPONSOR_SLOTS.filter((one) => one.format === name)) {
        const path = chosen[slot.device];
        if (path === undefined) continue;
        const picture = pictureAt(path);
        if (picture) {
          creatives[slot.device] = picture;
          continue;
        }
        const result = checked.get(path);
        if (result && "problem" in result) {
          fieldErrors[`sponsors.${index}.${name}.${slot.device}`] = [result.problem];
        }
      }
      value[name] = creatives;
    }
    return value;
  });

  if (Object.keys(fieldErrors).length > 0) {
    throw new ActionError("VALIDATION", "A sponsor's picture or project cannot be used", {
      fieldErrors,
    });
  }

  // A value the public side would ignore must never be stored: the whole setting would silently fall back to none.
  const readable = SITE_SETTING_SCHEMAS.sponsors.safeParse({ style, ads });
  if (!readable.success || toSponsorAds(ads, "https://storage.invalid").length !== ads.length) {
    throw new ActionError("INTERNAL", "The sponsors do not match the shape the site reads");
  }

  await store.write(ads, style);

  const kept = new Set(
    ads.flatMap((ad) => [
      ...(["strip", "panel"] as const).flatMap((name) => {
        const creatives = ad[name] as Record<string, StoredPicture> | undefined;
        return creatives ? Object.values(creatives).map((picture) => picture.path) : [];
      }),
      ...(ad.photo ? [(ad.photo as StoredPicture).path] : []),
    ]),
  );
  const gone = [...before.paths].filter((path) => !kept.has(path));
  if (gone.length > 0) {
    try {
      await store.removeFiles(gone);
    } catch {
      log?.warn("sponsor pictures could not be removed from the bucket", { count: gone.length });
    }
  }

  return { count: ads.length, active: input.sponsors.filter((sponsor) => sponsor.active).length };
}
