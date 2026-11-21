import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CareersListScreen,
  careersListMetadata,
  getCareersPage,
  parsePublicJobParams,
} from "@/features/careers";
import { getTranslate, requireContentModule } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [raw, translate] = await Promise.all([searchParams, getTranslate()]);
  return careersListMetadata(translate, parsePublicJobParams(raw));
}

/**
 * The public Careers list (ADR-143): open jobs, newest first, with a search box, four filters and page links that all
 * live in the address (`?q=&department=&location=&mode=&type=&page=`). When the Careers module is switched off in the
 * admin the page answers the normal not-found page, and so does a page number past the last one. Reading the address
 * makes the page dynamic, so `loading.tsx` stands in while it is on its way; a list without free words is read through
 * the cache under the `careers` tag, which every admin change refreshes, and a search is never cached.
 */
export default async function CareersPage({ searchParams }: PageProps) {
  await requireContentModule("careers");
  const params = parsePublicJobParams(await searchParams);
  const data = await getCareersPage(params);
  if (params.page > data.list.pageCount) notFound();
  return (
    <main id="main" className="flex-1">
      <CareersListScreen data={data} params={params} />
    </main>
  );
}
