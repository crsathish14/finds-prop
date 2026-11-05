import type { Metadata } from "next";

/** The share image every page falls back to (a route that draws the brand card). */
export const SHARE_IMAGE_PATH = "/share-image.png";
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;

/** Pages that must not be indexed or followed (FR-PUB-14): comparison, sign-in, account and portals. */
export const NO_INDEX: Pick<Metadata, "robots"> = { robots: { index: false, follow: false } };

export type PageMetadataInput = {
  /** A plain title gets the site template ("Title · Find Prop"); `absolute` is used as it is. */
  title: string | { absolute: string };
  description: string;
  /** The canonical path, with the query when the query is part of the page (`/properties?bhk=3`). */
  path: string;
  siteName: string;
  /** A whole address; the default share image is used when there is none. */
  image?: string | null;
  imageAlt?: string;
};

/**
 * What a public page says about itself: title and description, its one canonical address, and the
 * Open Graph and Twitter tags that make a shared link a card (FR-PUB-14). Paths stay relative; the
 * root layout's `metadataBase` (the site address from the environment) makes them whole. A child
 * page's `openGraph` replaces its parent's rather than merging, so every page builds the whole object
 * here instead of leaning on the layout.
 */
export function pageMetadata(input: PageMetadataInput): Metadata {
  const title = typeof input.title === "string" ? input.title : input.title.absolute;
  const alt = input.imageAlt ?? title;
  const own = input.image ?? null;
  const image =
    own === null
      ? { url: SHARE_IMAGE_PATH, width: SHARE_IMAGE_WIDTH, height: SHARE_IMAGE_HEIGHT, alt }
      : { url: own, alt };
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      type: "website",
      title,
      description: input.description,
      url: input.path,
      siteName: input.siteName,
      locale: "en_IN",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: input.description,
      images: [{ url: image.url, alt }],
    },
  };
}
