import type { Metadata } from "next";
import { FaqScreen, faqMetadata, getFaqPage, parsePublicFaqParams } from "@/features/faq";
import { getTranslate, requireContentModule } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const [raw, translate] = await Promise.all([searchParams, getTranslate()]);
  return faqMetadata(translate, parsePublicFaqParams(raw));
}

/**
 * The public FAQ (ADR-143): the published questions of the active categories, grouped, with a search and category
 * chips that live in the address. When the FAQ module is switched off in the admin the page answers the normal
 * not-found page. Reading the address makes the page dynamic, so `loading.tsx` stands in while it is on its way; the
 * questions themselves are read through the cache under the `faq` tag, which every admin change refreshes.
 */
export default async function FaqPage({ searchParams }: PageProps) {
  await requireContentModule("faq");
  const params = parsePublicFaqParams(await searchParams);
  const page = await getFaqPage(params);
  return (
    <main id="main" className="flex-1">
      <FaqScreen
        faqs={page.faqs}
        categories={page.categories}
        params={{ query: params.query, category: page.category }}
        nothingPublished={page.nothingPublished}
      />
    </main>
  );
}
