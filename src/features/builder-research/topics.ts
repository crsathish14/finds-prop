/**
 * The fixed topics of builder research (AI search Phase 4, owner decisions 27 Nov 2026). The assistant turns a buyer's
 * question into one of them; a builder tags each extra page with one of the page topics. Only these exist: a topic a
 * builder made up could match no question.
 */

/** What a builder's extra page is about (the dropdown on the profile). `other` is read only for general questions. */
export const PAGE_TOPICS = [
  "about_company",
  "projects",
  "delivery_record",
  "awards_approvals",
  "contact",
  "other",
] as const;
export type PageTopic = (typeof PAGE_TOPICS)[number];

/** What a buyer's question is about (the assistant's choice): the page topics without `other`, and `general`. */
export const QUESTION_TOPICS = [
  "about_company",
  "projects",
  "delivery_record",
  "awards_approvals",
  "contact",
  "general",
] as const;
export type QuestionTopic = (typeof QUESTION_TOPICS)[number];

/**
 * The words that score a page for each topic, matched in the link's text and in its address (`-` and `_` count as
 * spaces). A general question scores none: it takes the builder's pages and the best About and Projects pages.
 */
export const TOPIC_WORDS: Readonly<Record<Exclude<QuestionTopic, "general">, readonly string[]>> = {
  about_company: [
    "about",
    "company",
    "profile",
    "history",
    "team",
    "who we are",
    "our story",
    "vision",
  ],
  projects: ["projects", "project", "ongoing", "upcoming", "completed", "properties", "portfolio"],
  delivery_record: [
    "completed",
    "delivered",
    "handed over",
    "projects",
    "project",
    "past projects",
    "portfolio",
    "track record",
    "testimonials",
  ],
  awards_approvals: [
    "awards",
    "award",
    "certifications",
    "certificate",
    "rera",
    "approvals",
    "recognition",
  ],
  contact: ["contact", "reach us", "get in touch", "enquiry", "office", "location"],
};
