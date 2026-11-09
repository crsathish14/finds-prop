import type { SiteSettings } from "@/features/site";

/**
 * What the Header and Footer pages do with the values, kept apart from the screens so they can be tested on their own
 * (S7-T10, FR-ADM-10): where the boxes start (what is saved, or what visitors see today when nothing is), the payload a
 * save sends, the server's problems put on the boxes they belong to, and the small picture beside the boxes. Pure: no
 * server code, so a client island may import it.
 *
 * The standard header and footer (links, button, copyright line) are worked out on the server with the same builders the
 * public pages use (`buildHeader`, `buildFooter`) and passed in, so the picture and the real page apply one rule: an
 * empty list or box means "use the standard" (BR-81).
 */

/** A link as stored. */
export interface FormLink {
  label: string;
  href: string;
}

/** A link row in the list: the id is the page's own, never shown or saved. */
export interface LinkRowValue extends FormLink {
  id: string;
}

export interface LinkRowProblems {
  label?: string;
  href?: string;
}

/** Problems by the field path the server uses ("links.2.href"), already in words. */
export type Problems = Readonly<Record<string, string>>;

/** The rows of a list of links, numbered so the page and the browser agree on them (no random ids before the first click). */
export function linkRowsOf(links: readonly FormLink[], prefix: string): LinkRowValue[] {
  return links.map((link, index) => ({
    id: `${prefix}-${index + 1}`,
    label: link.label,
    href: link.href,
  }));
}

const linksOf = (rows: readonly FormLink[]): FormLink[] =>
  rows.map((row) => ({ label: row.label, href: row.href }));

/** The problems of the link rows, put on the row that has them (a path names the row by its place in the list). */
export function linkProblemsOf(
  prefix: string,
  problems: Problems,
  rows: readonly { id: string }[],
): Record<string, LinkRowProblems> {
  const found: Record<string, LinkRowProblems> = {};
  const pattern = new RegExp(`^${prefix}\\.(\\d+)\\.(label|href)$`);
  for (const [path, message] of Object.entries(problems)) {
    const match = pattern.exec(path);
    const place = match?.[1];
    const box = match?.[2];
    const row = place === undefined ? undefined : rows[Number(place)];
    if (!row || (box !== "label" && box !== "href")) continue;
    found[row.id] = { ...found[row.id], [box]: message };
  }
  return found;
}

const filled = (typed: string) => typed.trim() !== "";

// --- header ------------------------------------------------------------------------------------------------------

/** What the public header shows when nothing is saved, as `buildHeader` works it out (links already filtered by flags). */
export interface StandardHeader {
  brandName: string;
  links: FormLink[];
  cta?: FormLink | undefined;
}

/** The standard header from what `buildHeader` returned for a header with nothing saved. */
export function standardHeaderOf(model: {
  brandName: string;
  links: readonly FormLink[];
  cta?: FormLink | undefined;
}): StandardHeader {
  return {
    brandName: model.brandName,
    links: linksOf(model.links),
    ...(model.cta ? { cta: { label: model.cta.label, href: model.cta.href } } : {}),
  };
}

export interface HeaderFormValues {
  name: string;
  links: FormLink[];
  ctaLabel: string;
  ctaHref: string;
}

/**
 * Where the Header page's boxes start. Saved links and button are shown as saved; when none are saved, the boxes start
 * with the links and the button visitors see today, so the admin edits from what is there instead of from a blank list.
 * The site name starts empty when none is saved ("Leave the name empty to use Find Prop").
 */
export function headerFormOf(
  saved: SiteSettings["header"],
  standard: StandardHeader,
): HeaderFormValues {
  const cta = saved.cta ?? standard.cta;
  return {
    name: saved.name ?? "",
    links: linksOf(saved.links.length > 0 ? saved.links : standard.links),
    ctaLabel: cta?.label ?? "",
    ctaHref: cta?.href ?? "",
  };
}

export function headerPayloadOf(values: {
  name: string;
  links: readonly FormLink[];
  ctaLabel: string;
  ctaHref: string;
}): Record<string, unknown> {
  return {
    name: values.name,
    links: linksOf(values.links),
    cta: { label: values.ctaLabel, href: values.ctaHref },
  };
}

export interface HeaderProblems {
  name?: string;
  ctaLabel?: string;
  ctaHref?: string;
  links?: Record<string, LinkRowProblems>;
}

export function headerProblemsOf(
  problems: Problems,
  rows: readonly { id: string }[],
): HeaderProblems {
  const links = linkProblemsOf("links", problems, rows);
  return {
    ...(problems.name ? { name: problems.name } : {}),
    ...(problems["cta.label"] ? { ctaLabel: problems["cta.label"] } : {}),
    ...(problems["cta.href"] ? { ctaHref: problems["cta.href"] } : {}),
    ...(Object.keys(links).length > 0 ? { links } : {}),
  };
}

export interface HeaderPicture {
  brandName: string;
  links: string[];
  cta?: string;
}

/** The small picture of the header: what the public header would show if the boxes were saved as they are. */
export function headerPictureOf(
  values: { name: string; links: readonly FormLink[]; ctaLabel: string; ctaHref: string },
  standard: StandardHeader,
): HeaderPicture {
  const typedLinks = values.links
    .filter((link) => filled(link.label))
    .map((link) => link.label.trim());
  const typedCta = filled(values.ctaLabel) || filled(values.ctaHref);
  const cta = typedCta ? values.ctaLabel.trim() : standard.cta?.label;
  return {
    brandName: values.name.trim() || standard.brandName,
    links: values.links.length > 0 ? typedLinks : standard.links.map((link) => link.label),
    ...(cta ? { cta } : {}),
  };
}

// --- footer ------------------------------------------------------------------------------------------------------

/** What the public footer shows when nothing is saved, as `buildFooter` works it out. */
export interface StandardFooter {
  brandName: string;
  links: FormLink[];
  copyright: string;
}

/** The standard footer from what `buildFooter` returned for a footer with no links and no copyright line saved. */
export function standardFooterOf(model: {
  brandName: string;
  links: readonly FormLink[];
  copyright: string;
}): StandardFooter {
  return { brandName: model.brandName, links: linksOf(model.links), copyright: model.copyright };
}

export interface FooterFormValues {
  about: string;
  phone: string;
  email: string;
  address: string;
  links: FormLink[];
  copyright: string;
}

/** Where the Footer page's boxes start: as saved, or, with no links saved, the links visitors see today. */
export function footerFormOf(
  saved: SiteSettings["footer"],
  standard: StandardFooter,
): FooterFormValues {
  return {
    about: saved.about ?? "",
    phone: saved.contact?.phone ?? "",
    email: saved.contact?.email ?? "",
    address: saved.contact?.address ?? "",
    links: linksOf(saved.links.length > 0 ? saved.links : standard.links),
    copyright: saved.copyright ?? "",
  };
}

export function footerPayloadOf(values: {
  about: string;
  phone: string;
  email: string;
  address: string;
  links: readonly FormLink[];
  copyright: string;
}): Record<string, unknown> {
  return {
    about: values.about,
    contact: { address: values.address, email: values.email, phone: values.phone },
    links: linksOf(values.links),
    copyright: values.copyright,
  };
}

export interface FooterProblems {
  about?: string;
  phone?: string;
  email?: string;
  address?: string;
  copyright?: string;
  links?: Record<string, LinkRowProblems>;
}

export function footerProblemsOf(
  problems: Problems,
  rows: readonly { id: string }[],
): FooterProblems {
  const links = linkProblemsOf("links", problems, rows);
  const one = (box: "about" | "phone" | "email" | "address" | "copyright") => {
    const message =
      box === "about" || box === "copyright" ? problems[box] : problems[`contact.${box}`];
    return message ? { [box]: message } : {};
  };
  return {
    ...one("about"),
    ...one("address"),
    ...one("email"),
    ...one("phone"),
    ...one("copyright"),
    ...(Object.keys(links).length > 0 ? { links } : {}),
  };
}

export interface FooterPicture {
  brandName: string;
  about?: string;
  contacts: string[];
  links: string[];
  copyright: string;
}

/** The small picture of the footer: the contact lines in the public order (address, phone, email), the links and the line. */
export function footerPictureOf(
  values: {
    about: string;
    phone: string;
    email: string;
    address: string;
    links: readonly FormLink[];
    copyright: string;
  },
  standard: StandardFooter,
): FooterPicture {
  const about = values.about.trim();
  const typedLinks = values.links
    .filter((link) => filled(link.label))
    .map((link) => link.label.trim());
  return {
    brandName: standard.brandName,
    ...(about ? { about } : {}),
    contacts: [values.address, values.phone, values.email]
      .map((line) => line.trim())
      .filter(Boolean),
    links: values.links.length > 0 ? typedLinks : standard.links.map((link) => link.label),
    copyright: values.copyright.trim() || standard.copyright,
  };
}

// --- hero --------------------------------------------------------------------------------------------------------

/** What the public hero shows when nothing is saved, as `buildHero` works it out (the headline can name the region). */
export interface StandardHero {
  title: string;
  subtitle: string;
}

export type HeroLayoutValue = "search_desk" | "split";

export interface HeroFormValues {
  eyebrow: string;
  title: string;
  subtitle: string;
  layout: HeroLayoutValue;
}

/** The standard hero from what `buildHero` returned for a hero with only the layout saved. */
export function standardHeroOf(model: { title: string; subtitle: string }): StandardHero {
  return { title: model.title, subtitle: model.subtitle };
}

/**
 * Where the Hero page's boxes start. The headline is needed (it cannot be left empty), so with none saved the box starts
 * on the headline visitors see today; saving it unchanged keeps that wording. The eyebrow and the subtitle start empty
 * when none is saved, and the picture shows the standard subtitle.
 */
export function heroFormOf(saved: SiteSettings["hero"], standard: StandardHero): HeroFormValues {
  return {
    eyebrow: saved.eyebrow ?? "",
    title: saved.title ?? standard.title,
    subtitle: saved.subtitle ?? "",
    layout: saved.layout,
  };
}

export function heroPayloadOf(values: HeroFormValues): Record<string, unknown> {
  return {
    eyebrow: values.eyebrow,
    title: values.title,
    subtitle: values.subtitle,
    layout: values.layout,
  };
}

export interface HeroProblems {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}

export function heroProblemsOf(problems: Problems): HeroProblems {
  return {
    ...(problems.eyebrow ? { eyebrow: problems.eyebrow } : {}),
    ...(problems.title ? { title: problems.title } : {}),
    ...(problems.subtitle ? { subtitle: problems.subtitle } : {}),
  };
}

export interface HeroPicture {
  title: string;
  subtitle: string;
  eyebrow?: string;
  layout: HeroLayoutValue;
}

/** The small picture of the hero: the typed words, or the standard ones where a box is empty (BR-81). */
export function heroPictureOf(values: HeroFormValues, standard: StandardHero): HeroPicture {
  const eyebrow = values.eyebrow.trim();
  return {
    title: values.title.trim() || standard.title,
    subtitle: values.subtitle.trim() || standard.subtitle,
    ...(eyebrow ? { eyebrow } : {}),
    layout: values.layout,
  };
}

// --- homepage ----------------------------------------------------------------------------------------------------

/** How many curated localities become Popular chips in the search card (the same count the search feature uses, ADD-11). */
export const POPULAR_CHIPS = 4;

export const HOMEPAGE_SWITCHES = [
  "showFeatured",
  "showProjectTypes",
  "showDiscovery",
  "showWhyUs",
  "showCta",
] as const;

export type HomepageSwitch = (typeof HOMEPAGE_SWITCHES)[number];

/** A locality as the boxes hold it: all text as typed (the server reads the numbers). */
export interface LocalityFormRow {
  label: string;
  lat: string;
  lng: string;
  radiusKm: string;
}

export interface LocalityRowValue extends LocalityFormRow {
  id: string;
}

export type HomepageFormValues = Record<HomepageSwitch, boolean> & {
  localities: LocalityFormRow[];
};

/** Where the Homepage page's boxes start: the saved switches and localities (the defaults when nothing is saved). */
export function homepageFormOf(saved: SiteSettings["homepage"]): HomepageFormValues {
  return {
    showFeatured: saved.showFeatured,
    showProjectTypes: saved.showProjectTypes,
    showDiscovery: saved.showDiscovery,
    showWhyUs: saved.showWhyUs,
    showCta: saved.showCta,
    localities: saved.localities.map((place) => ({
      label: place.label,
      lat: String(place.lat),
      lng: String(place.lng),
      radiusKm: String(place.radiusKm),
    })),
  };
}

export function localityRowsOf(
  localities: readonly LocalityFormRow[],
  prefix: string,
): LocalityRowValue[] {
  return localities.map((place, index) => ({ id: `${prefix}-${index + 1}`, ...place }));
}

export function homepagePayloadOf(
  values: Record<HomepageSwitch, boolean> & { localities: readonly LocalityFormRow[] },
): Record<string, unknown> {
  return {
    showFeatured: values.showFeatured,
    showProjectTypes: values.showProjectTypes,
    showDiscovery: values.showDiscovery,
    showWhyUs: values.showWhyUs,
    showCta: values.showCta,
    localities: values.localities.map((place) => ({
      label: place.label,
      lat: place.lat,
      lng: place.lng,
      radiusKm: place.radiusKm,
    })),
  };
}

export type LocalityProblems = Partial<Record<keyof LocalityFormRow, string>>;

/** The localities' problems, put on the row at the place the server names (`localities.2.lat`). */
export function localityProblemsOf(
  problems: Problems,
  rows: readonly { id: string }[],
): Record<string, LocalityProblems> {
  const found: Record<string, LocalityProblems> = {};
  for (const [path, message] of Object.entries(problems)) {
    const match = /^localities\.(\d+)\.(label|lat|lng|radiusKm)$/.exec(path);
    const place = match?.[1];
    const box = match?.[2] as keyof LocalityFormRow | undefined;
    const row = place === undefined ? undefined : rows[Number(place)];
    if (!row || !box) continue;
    found[row.id] = { ...found[row.id], [box]: message };
  }
  return found;
}

export type HomepageSectionKey =
  "hero" | "discovery" | "featured" | "projectTypes" | "whyUs" | "cta";

export interface HomepagePicture {
  sections: { key: HomepageSectionKey; on: boolean }[];
  popular: string[];
  tiles: string[];
}

/**
 * The small picture of the home page: the sections in the order of the page with their state, the Popular chips (the
 * first four localities) and the locality tiles. A locality section with no localities is drawn Off, as the public page
 * leaves out a section with nothing to show (FR-PUB-05).
 */
export function homepagePictureOf(values: {
  showFeatured: boolean;
  showProjectTypes: boolean;
  showDiscovery: boolean;
  showWhyUs: boolean;
  showCta: boolean;
  localities: readonly { label: string }[];
}): HomepagePicture {
  const labels = values.localities.map((place) => place.label.trim()).filter(Boolean);
  return {
    sections: [
      { key: "hero", on: true },
      { key: "discovery", on: values.showDiscovery && labels.length > 0 },
      { key: "featured", on: values.showFeatured },
      { key: "projectTypes", on: values.showProjectTypes },
      { key: "whyUs", on: values.showWhyUs },
      { key: "cta", on: values.showCta },
    ],
    popular: labels.slice(0, POPULAR_CHIPS),
    tiles: labels,
  };
}
