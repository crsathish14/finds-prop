import type { Metadata } from "next";
import { pageMetadata } from "@/features/seo";
import type { Translate } from "@/lib/format";
import { FAQ_PATH, type PublicFaqParams } from "./page-params";

/**
 * The FAQ page's title, description and one canonical address (ADR-143, FR-PUB-14): always the page itself, never a
 * search or a category, so every variant points at /faq. A page narrowed by words or a category is not indexed (its
 * links are still followed), so a search engine keeps the one page with every question.
 */
export function faqMetadata(translate: Translate, params: PublicFaqParams): Metadata {
  const base = pageMetadata({
    title: translate("faq.meta.title"),
    description: translate("faq.meta.description"),
    path: FAQ_PATH,
    siteName: translate("meta.title"),
  });
  const narrowed = params.query !== "" || params.category !== "";
  return narrowed ? { ...base, robots: { index: false, follow: true } } : base;
}
