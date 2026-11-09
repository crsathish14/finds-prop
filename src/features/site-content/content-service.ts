import { ActionError } from "@/server/actions/normalise-error";
import { SITE_SETTING_SCHEMAS } from "@/features/site";
import type { EditableSetting } from "./constants";
import type { FooterInput, HeaderInput, HeroInput, HomepageInput } from "./schemas";

/**
 * The rules of saving the site content (S7-T10, FR-ADM-10, FR-ADM-11), apart from the code that reaches the database
 * so they can be tested with a stand-in. The real store is in `service.ts`: it acts as the signed-in admin, so the
 * database's own policies decide what is allowed (only the super admin may write `site_settings`; the audit trigger
 * records which setting changed, never its content). The action has already checked the caller is the super admin
 * and counted the rate limit.
 */

/** The launch area, as the `region` setting holds it. */
export interface RegionBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Calls made as the signed-in admin. */
export interface ContentStore {
  /** Replaces one setting's value (adds the row the first time). Throws the database's failure through `mapContentError`. */
  write(key: EditableSetting, value: Record<string, unknown>): Promise<void>;
  /** The launch area a locality must lie in: the saved `region` setting, or the built-in box. */
  readBounds(): Promise<RegionBounds>;
}

/** What was saved: enough for the page to say which setting changed. */
export interface ContentDone {
  key: EditableSetting;
}

/** What the database says when a call fails. */
export interface ContentFailure {
  code?: string | undefined;
  message?: string | undefined;
}

/** Turns what the database raises into the closed set of action errors. */
export function mapContentError(failure: ContentFailure): ActionError {
  const { code } = failure;
  if (code === "42501") {
    return new ActionError("FORBIDDEN", "You don't have permission to do that.");
  }
  if (code === "23514" || code === "22P02" || code === "23502") {
    return new ActionError("VALIDATION", "The site content is not valid");
  }
  return new ActionError("INTERNAL", "The site content could not be saved");
}

/** An object without the keys that hold nothing: a cleared box is left out, so the default shows again (BR-81). */
function compact<T extends Record<string, unknown>>(source: T): Record<string, unknown> {
  const kept: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(source)) {
    if (value !== undefined && value !== null) kept[name] = value;
  }
  return kept;
}

export function headerValue(input: HeaderInput): Record<string, unknown> {
  return compact({
    name: input.name,
    links: input.links.map((link) => ({ label: link.label, href: link.href })),
    cta: input.cta ? { label: input.cta.label, href: input.cta.href } : null,
  });
}

export function footerValue(input: FooterInput): Record<string, unknown> {
  const contact = input.contact
    ? compact({
        address: input.contact.address,
        email: input.contact.email,
        phone: input.contact.phone,
      })
    : {};
  return compact({
    about: input.about,
    contact: Object.keys(contact).length > 0 ? contact : null,
    links: input.links.map((link) => ({ label: link.label, href: link.href })),
    copyright: input.copyright,
  });
}

export function heroValue(input: HeroInput): Record<string, unknown> {
  return compact({
    eyebrow: input.eyebrow,
    title: input.title,
    subtitle: input.subtitle,
    layout: input.layout,
  });
}

export function homepageValue(input: HomepageInput): Record<string, unknown> {
  return {
    showFeatured: input.showFeatured,
    showProjectTypes: input.showProjectTypes,
    showDiscovery: input.showDiscovery,
    showWhyUs: input.showWhyUs,
    showCta: input.showCta,
    localities: input.localities.map((place) => ({
      label: place.label,
      lat: place.lat,
      lng: place.lng,
      radiusKm: place.radiusKm,
    })),
  };
}

/** True when the point lies outside the launch area. */
export function isOutside(lat: number, lng: number, bounds: RegionBounds): boolean {
  return lat < bounds.south || lat > bounds.north || lng < bounds.west || lng > bounds.east;
}

/**
 * Writes one setting after checking it once more against the shape the public side reads: a value that shape would
 * ignore must never be stored, because the whole setting would then silently fall back to the defaults.
 */
async function publish(
  store: ContentStore,
  key: EditableSetting,
  value: Record<string, unknown>,
): Promise<ContentDone> {
  const readable = SITE_SETTING_SCHEMAS[key].safeParse(value);
  if (!readable.success) {
    throw new ActionError("INTERNAL", `The ${key} setting does not match the shape the site reads`);
  }
  await store.write(key, value);
  return { key };
}

export function saveHeaderContent(store: ContentStore, input: HeaderInput): Promise<ContentDone> {
  return publish(store, "header", headerValue(input));
}

export function saveFooterContent(store: ContentStore, input: FooterInput): Promise<ContentDone> {
  return publish(store, "footer", footerValue(input));
}

export function saveHeroContent(store: ContentStore, input: HeroInput): Promise<ContentDone> {
  return publish(store, "hero", heroValue(input));
}

/**
 * The homepage switches and the curated localities. A locality must lie inside the launch area (the `region`
 * setting): a mistyped coordinate would otherwise send visitors to a place with no homes. The refusal names the
 * latitude box of each row that is outside, so the screen can put the sentence on that row.
 */
export async function saveHomepageContent(
  store: ContentStore,
  input: HomepageInput,
): Promise<ContentDone> {
  const bounds = await store.readBounds();
  const fieldErrors: Record<string, { key: string }[]> = {};
  input.localities.forEach((place, index) => {
    if (isOutside(place.lat, place.lng, bounds)) {
      fieldErrors[`localities.${index}.lat`] = [{ key: "validation.outsideRegion" }];
    }
  });
  if (Object.keys(fieldErrors).length > 0) {
    throw new ActionError("VALIDATION", "A locality lies outside the area the site covers", {
      fieldErrors,
    });
  }
  return publish(store, "homepage", homepageValue(input));
}
