import { JSON_LD_CONTEXT, type JsonLdDocument } from "@/features/seo";
import type { FaqView } from "./view";

/**
 * The FAQ page's structured data for search engines (ADR-143, FR-PUB-14): a FAQPage with one Question and its
 * accepted Answer for each question the page shows. The answer is the admin's plain text as it is (paragraphs
 * separated by a blank line); search engines read it as text. The questions are the ones on the page, so the data
 * and the page agree: a search that narrows the page narrows the data too.
 */
export function faqPageDocument(faqs: readonly FaqView[]): JsonLdDocument {
  return {
    "@context": JSON_LD_CONTEXT,
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}
