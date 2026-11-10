/**
 * The settings the admin edits on the four Site content pages (S7-T10, FR-ADM-10, FR-ADM-11). Each page saves its own
 * row of `site_settings`, so saving the hero never touches the header, the footer or the sponsors (S7-T11). The
 * `region` row has no editor in the approved design and stays as it was seeded.
 */
export const EDITABLE_SETTINGS = ["header", "hero", "homepage", "footer"] as const;
export type EditableSetting = (typeof EDITABLE_SETTINGS)[number];

/** How many links the header and the footer may hold (the same limits the public side reads with). */
export const HEADER_LINKS_MAX = 12;
export const FOOTER_LINKS_MAX = 20;

/**
 * How many curated localities the admin may keep (ADD-11, owner decision 9 Nov 2026). The public side still reads up
 * to 30, so a longer list that is already stored stays readable; only a save is held to this limit.
 */
export const LOCALITIES_MAX = 8;

/** The search distance offered for a locality, in kilometres, and the one a new row starts with (ADD-11). */
export const LOCALITY_RADII_KM = [2, 3, 4, 5, 6] as const;
export const DEFAULT_LOCALITY_RADIUS_KM = 3;

/** The two hero arrangements (FR-ADM-11): the same words and search, with the banner under or beside the search. */
export const HERO_LAYOUTS = ["search_desk", "split"] as const;
export type HeroLayout = (typeof HERO_LAYOUTS)[number];

/** Text limits, the same as the shapes the public side reads (`features/site/schemas.ts`). */
export const SITE_NAME_MAX = 60;
export const LINK_LABEL_MAX = 60;
export const LINK_TARGET_MAX = 2000;
export const HERO_EYEBROW_MAX = 80;
export const HERO_TITLE_MAX = 120;
export const HERO_SUBTITLE_MAX = 240;
export const FOOTER_ABOUT_MAX = 400;
export const FOOTER_ADDRESS_MAX = 200;
export const FOOTER_PHONE_MAX = 30;
export const FOOTER_COPYRIGHT_MAX = 200;
export const LOCALITY_LABEL_MAX = 60;
export const LOCALITY_RADIUS_MAX_KM = 100;

/**
 * How many sponsors the admin may keep (owner decision 9 Nov 2026); the public side still reads up to 30, so a longer
 * list that is already stored stays readable and only a save is held to this limit.
 */
export const SPONSORS_MAX = 10;

/** The most a sponsor's picture may weigh: 150 KB (the approved screen, DEC-15). The bucket's own hard cap is 500 KB. */
export const SPONSOR_IMAGE_MAX_KB = 150;
export const SPONSOR_IMAGE_MAX_BYTES = SPONSOR_IMAGE_MAX_KB * 1024;

/**
 * The public bucket the sponsors' pictures are kept in, under `sponsors/<the sponsor's id>/`. The same name as the
 * public side's `SPONSOR_BUCKET` (a test holds them together); it is repeated here because the browser code of this
 * feature may not take values from another feature's index.
 */
export const SPONSOR_IMAGE_BUCKET = "site-assets";

export const SPONSOR_ADVERTISER_MAX = 80;
export const SPONSOR_ALT_MAX = 200;
export const SPONSOR_HREF_MAX = 2000;
