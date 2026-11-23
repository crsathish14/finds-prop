import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { siteOrigin } from "@/features/seo";
import {
  getSitemapBlog,
  getSitemapCareers,
  getSitemapFaq,
  getSitemapSources,
  sitemapEntries,
} from "@/features/sitemap";

/**
 * `sitemap.xml` (FR-PUB-14): the public pages, every live project and every approved home, with the
 * date each last changed, the FAQ page while its module is on and has questions, and the Blog list and its published articles while the Blog is on, and the Careers list and its open jobs while Careers is on (ADR-143). It waits for a request, so a build with no database never bakes in an empty
 * or failed list; the reads are cached for minutes under the homes and projects tags. A failed read
 * throws and the answer is a 500, so a crawler comes back instead of trusting a partial sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [{ homes, projects }, faq, blog, careers] = await Promise.all([
    getSitemapSources(),
    getSitemapFaq(),
    getSitemapBlog(),
    getSitemapCareers(),
  ]);
  return sitemapEntries({ origin: siteOrigin(), homes, projects, faq, blog, careers });
}
