import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { EnquiryCardSkeleton } from "@/components/domain/enquiry-card";
import { CompareButton } from "@/features/compare";
import { LISTING_BUCKET, publicStorageUrl } from "@/features/home";
import {
  canonicalPropertyPath,
  enquiryLinks,
  EnquiryPanel,
  getProperty,
  metaDescription,
  MobileEnquirySlot,
  parsePropertyAddress,
  perSqftRupees,
  propertyPath,
  PropertyScreen,
} from "@/features/property";
import { getTranslate } from "@/features/site";
import { publicEnv } from "@/lib/public-env";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const address = parsePropertyAddress(slug);
  const translate = await getTranslate();
  if (address === null) return { title: translate("property.page.notFound.title") };
  const result = await getProperty(address.shortId);
  if (result.status === "missing") return { title: translate("property.page.notFound.title") };
  const description = metaDescription(result.property);
  return {
    title: result.property.title,
    ...(description === null ? {} : { description }),
  };
}

/**
 * The property page (S4-T03, ADR-043). The address carries the public id; the home is read by it. An
 * address that is not a slug and an id, or an id no approved home has, is "not found"; a known id
 * with another slug is sent (308) to the canonical address. The enquiry is behind its own Suspense
 * boundaries, so who is signed in never holds back the photos and the details.
 */
export default async function PropertyPage({ params }: PageProps) {
  const { slug } = await params;
  const address = parsePropertyAddress(slug);
  if (address === null) notFound();
  const result = await getProperty(address.shortId);
  if (result.status === "missing") notFound();
  const { property } = result;

  const canonical = canonicalPropertyPath(slug, {
    slug: property.slug,
    shortId: property.shortId,
  });
  if (canonical !== null) permanentRedirect(canonical);

  const { signInHref, createAccountHref } = enquiryLinks(
    propertyPath(property.slug, property.shortId),
  );
  const perSqft = perSqftRupees(property);
  const photoSources = property.photos.map((photo) =>
    publicStorageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, LISTING_BUCKET, photo.path),
  );

  // `pb-24` leaves room under the last section for the phone's sticky bar (hidden from 1024 px).
  return (
    <main id="main" className="flex-1 pb-24 lg:pb-0">
      <PropertyScreen
        property={property}
        photoSources={photoSources}
        actions={
          <CompareButton
            shortId={property.shortId}
            title={property.title}
            cover={photoSources[0] ?? null}
          />
        }
        enquiry={
          <Suspense fallback={<EnquiryCardSkeleton />}>
            <EnquiryPanel signInHref={signInHref} createAccountHref={createAccountHref} />
          </Suspense>
        }
        mobileEnquiry={
          <Suspense fallback={null}>
            <MobileEnquirySlot
              signInHref={signInHref}
              createAccountHref={createAccountHref}
              rupees={property.price}
              listingType={property.listingType}
              perSqftRupees={perSqft}
            />
          </Suspense>
        }
      />
    </main>
  );
}
