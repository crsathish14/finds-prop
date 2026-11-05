import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  CompareScreen,
  compareHref,
  getComparedProperties,
  parseIdsParam,
  toCompareColumn,
} from "@/features/compare";
import { LISTING_BUCKET, publicStorageUrl } from "@/features/home";
import { NO_INDEX } from "@/features/seo";
import { getTranslate } from "@/features/site";
import { publicEnv } from "@/lib/public-env";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  // A comparison is for the visitor who made it, not for search (FR-PUB-14).
  return { title: translate("compare.title"), ...NO_INDEX };
}

/**
 * The comparison (S4-T02, ADR-044, FR-PUB-10). The address is the comparison: `?ids=` holds up to three
 * public ids. The homes are read the way the property page reads them; one that is gone (sold, rented,
 * withdrawn) is left out, and an address that asked for it, for a repeat, for a fourth or for something
 * that is not an id is sent to the address of what is shown. Fewer than two homes is the empty state.
 */
export default async function ComparePage({ searchParams }: PageProps) {
  const raw = await searchParams;
  const asked = raw["ids"];
  const properties = await getComparedProperties(parseIdsParam(asked));
  const present = properties.map((property) => property.shortId);

  const given = typeof asked === "string" ? asked : (asked?.[0] ?? "");
  if (given !== present.join(",")) redirect(compareHref(present));

  const columns = properties.map((property) => {
    const first = property.photos[0];
    return toCompareColumn(
      property,
      first
        ? publicStorageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, LISTING_BUCKET, first.path)
        : null,
    );
  });

  return (
    <main id="main" className="flex-1">
      <CompareScreen columns={columns} />
    </main>
  );
}
