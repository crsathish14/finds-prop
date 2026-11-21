import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  BlogListScreen,
  blogListMetadata,
  getBlogPage,
  parsePublicBlogParams,
} from "@/features/blog";
import { getTranslate, requireContentModule } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [raw, translate] = await Promise.all([searchParams, getTranslate()]);
  return blogListMetadata(translate, parsePublicBlogParams(raw));
}

/**
 * The public Blog list (ADR-143): published articles, newest first, with a search box, category chips, a tag row and page
 * links that all live in the address (`?q=&category=&tag=&page=`). When the Blog module is switched off in the admin the
 * page answers the normal not-found page, and so does a page number past the last one. Reading the address makes the
 * page dynamic, so `loading.tsx` stands in while it is on its way; a list without free words is read through the cache
 * under the `blog` tag, which every admin change refreshes, and a search is never cached.
 */
export default async function BlogPage({ searchParams }: PageProps) {
  await requireContentModule("blog");
  const params = parsePublicBlogParams(await searchParams);
  const data = await getBlogPage(params);
  if (params.page > data.list.pageCount) notFound();
  return (
    <main id="main" className="flex-1">
      <BlogListScreen data={data} params={params} />
    </main>
  );
}
