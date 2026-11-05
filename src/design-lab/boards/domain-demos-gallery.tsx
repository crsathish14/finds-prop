"use client";

import {
  PropertyGallery,
  PropertyGallerySkeleton,
  type GalleryPhoto,
} from "@/components/domain/property-gallery";
import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

const PICTURES = "/design-lab/listings";
const ART = [`${PICTURES}/home-a.svg`, `${PICTURES}/home-b.svg`, `${PICTURES}/home-c.svg`] as const;
const NAMES = [
  "Exterior",
  "Living room",
  "Bedroom",
  "Kitchen",
  "View from the balcony",
  "Floor plan",
] as const;

function photo(index: number, label?: string): GalleryPhoto {
  return {
    src: ART[index % ART.length] ?? ART[0],
    alt: `Drawn placeholder: ${label ?? `photo ${index + 1}`}`,
    label,
  };
}

const SIX: GalleryPhoto[] = NAMES.map((name, index) => photo(index, name));
const TWELVE: GalleryPhoto[] = Array.from({ length: 12 }, (_, index) =>
  photo(index, NAMES[index % NAMES.length]),
);
const FIRST_BROKEN: GalleryPhoto[] = [
  { src: `${PICTURES}/not-there.svg`, alt: "A photo that cannot load", label: "Exterior" },
  ...SIX.slice(1, 4),
];

const BADGES = (
  <>
    <Badge tone="outline">For sale</Badge>
    <Badge tone="featured">Featured</Badge>
  </>
);

const FRAME = "w-full max-w-3xl";

export function PropertyGalleryDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="Six photos with badges: arrows, count and thumbnails from 768 px; swipe and dots below that"
        className={FRAME}
      >
        <PropertyGallery photos={SIX} badges={BADGES} priority className="w-full" />
      </Specimen>
      <Specimen
        label="Starting on the fourth photo, and not running edge to edge on a phone"
        className={FRAME}
      >
        <PropertyGallery photos={SIX} startIndex={3} bleed={false} priority className="w-full" />
      </Specimen>
      <Specimen label="One photo: no arrows, thumbnails, dots or count" className={FRAME}>
        <PropertyGallery
          photos={SIX.slice(0, 1)}
          badges={BADGES}
          bleed={false}
          priority
          className="w-full"
        />
      </Specimen>
      <Specimen label="No photo: the illustrated tile" className={FRAME}>
        <PropertyGallery photos={[]} badges={BADGES} bleed={false} className="w-full" />
      </Specimen>
      <Specimen
        label="The first photo fails to load: the tile takes its place, the others work"
        className={FRAME}
      >
        <PropertyGallery photos={FIRST_BROKEN} bleed={false} className="w-full" />
      </Specimen>
      <Specimen label="Twelve photos: the thumbnails wrap to a second row" className={FRAME}>
        <PropertyGallery photos={TWELVE} bleed={false} priority className="w-full" />
      </Specimen>
      <Specimen
        label="Loading: the same box, so nothing moves when the photos arrive"
        className={FRAME}
      >
        <PropertyGallerySkeleton bleed={false} className="w-full" />
      </Specimen>
      <Text tone="muted">
        The left and right arrow keys change the photo while the picture has focus. On a phone the
        visitor swipes, and the dots show where they are. A full-screen viewer and zoom are not
        drawn in the UX, so they are not built.
      </Text>
    </div>
  );
}
