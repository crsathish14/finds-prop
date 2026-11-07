import type { Metadata } from "next";
import {
  getQueueCounts,
  getQueueLocalities,
  getQueuePage,
  ListingsScreen,
  loadMoreListings,
  moderateListing,
  queueFilterSchema,
} from "@/features/moderation";
import { getTranslate } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.listings.metaTitle") };
}

/**
 * The admin's listings page (S6-T04, FR-ADM-02): the queue of listings owners posted, with the decisions on
 * them. The address names the tab, the locality and the kind (`?tab=`, `?locality=`, `?kind=`); a value that is
 * not valid is dropped and the default queue shows. The queue, the numbers on the tabs and the localities to filter
 * by are read together, as the signed-in admin; the role gate in the layout has already sent anyone else away.
 */
export default async function ListingsPage({ searchParams }: PageProps) {
  const filters = queueFilterSchema.parse(await searchParams);
  const [page, counts, localities] = await Promise.all([
    getQueuePage(filters),
    getQueueCounts(),
    getQueueLocalities(),
  ]);
  return (
    <ListingsScreen
      filters={filters}
      page={page}
      counts={counts}
      localities={localities}
      actions={{ moderate: moderateListing, loadMore: loadMoreListings }}
    />
  );
}
