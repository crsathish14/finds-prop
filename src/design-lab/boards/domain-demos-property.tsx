"use client";

import { EnquiryCardSkeleton } from "@/components/domain/enquiry-card";
import { PropertyEnquiryCard } from "@/features/property/property-enquiry";
import { PropertyNotFound } from "@/features/property/property-not-found";
import { PropertyScreen } from "@/features/property/property-screen";
import { PropertySkeleton } from "@/features/property/property-skeleton";
import type { PropertyData } from "@/features/property/types";
import { Specimen } from "../frame";

const PICTURES = "/design-lab/listings";
const SOURCES = [`${PICTURES}/home-a.svg`, `${PICTURES}/home-b.svg`, `${PICTURES}/home-c.svg`];

const FULL: PropertyData = {
  id: "00000000-0000-4000-8000-000000000001",
  shortId: "k3x9a2bd",
  slug: "3-bhk-apartment-velachery",
  listingType: "sale",
  propertyType: "apartment",
  title: "3 BHK apartment with clubhouse and covered parking",
  description:
    "A bright east-facing apartment on a high floor in a gated community, a short walk from the Velachery MRTS station. The living and dining area opens onto a balcony, and all three bedrooms have built-in wardrobes.\n\nResidents share a clubhouse and a landscaped courtyard, and the apartment comes with one covered parking space.",
  bedrooms: 3,
  bathrooms: 2,
  areaSqft: 1420,
  price: 12_500_000,
  furnishing: "semi",
  amenities: [
    "Gym",
    "Swimming Pool",
    "24x7 Security",
    "Car Park",
    "Lift",
    "Power Backup",
    "Clubhouse",
    "Near Metro",
  ],
  availableFrom: null,
  locality: "Velachery",
  city: "Chennai",
  state: "Tamil Nadu",
  featured: true,
  label: "featured",
  ageDays: 2,
  photos: [
    { path: "1", alt: "Living room with a balcony" },
    { path: "2", alt: "Main bedroom" },
    { path: "3", alt: "Clubhouse" },
  ],
};

/** The UX's sparse state: a long title, one photo, and the details the owner did not add left out. */
const SPARSE: PropertyData = {
  ...FULL,
  shortId: "m4y8b3ce",
  title:
    "Beautifully maintained, east-facing 3 BHK apartment with a double-height living room, private lift lobby and a landscaped terrace garden in a quiet lane off Velachery Main Road",
  description: null,
  bathrooms: null,
  furnishing: null,
  areaSqft: null,
  amenities: [],
  price: 2_05_00_000,
  featured: false,
  label: "prime",
  ageDays: 21,
  photos: [{ path: "1", alt: null }],
};

const FRAME = "w-full rounded-xl border border-line bg-canvas";
const LINKS = { signInHref: "#sign-in", createAccountHref: "#create-account" };

function Page({
  property,
  signedIn,
  id,
}: {
  property: PropertyData;
  signedIn: boolean;
  id: string;
}) {
  return (
    <div className={FRAME} id={id}>
      <PropertyScreen
        titleAs="h2"
        property={property}
        photoSources={SOURCES.slice(0, property.photos.length)}
        enquiry={<PropertyEnquiryCard signedIn={signedIn} {...LINKS} />}
        // The sticky bar is pinned to the bottom of a phone's screen; the Sticky mobile bar entry shows it.
        mobileEnquiry={null}
      />
    </div>
  );
}

/** The property page in its states, with sample homes; nothing here navigates or sends. */
export function PropertyPageDemo() {
  return (
    <div className="flex flex-col gap-14">
      <Specimen
        label="A full listing, visitor not signed in: the gate beside the details"
        className="w-full"
      >
        <Page id="lab-property-full" property={FULL} signedIn={false} />
      </Specimen>
      <Specimen
        label="A sparse listing (long title, one photo, details left out, no description), visitor signed in: the form with Send switched off"
        className="w-full"
      >
        <Page id="lab-property-sparse" property={SPARSE} signedIn />
      </Specimen>
      <Specimen
        label="Loading, with the enquiry card waiting for the sign-in check"
        className="w-full"
      >
        <div className="flex w-full flex-col gap-6">
          <div className={FRAME}>
            <PropertySkeleton />
          </div>
          <div className="w-full max-w-sm">
            <EnquiryCardSkeleton />
          </div>
        </div>
      </Specimen>
      <Specimen
        label="Not found: a wrong address, or a home that is not approved"
        className="w-full"
      >
        <div className={FRAME}>
          <PropertyNotFound titleAs="h2" />
        </div>
      </Specimen>
    </div>
  );
}
