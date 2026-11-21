import { z } from "zod";
import { FAQ_ADMIN_VIEWS, FAQ_SEARCH_MAX, type FaqAdminViewName } from "./constants";

/**
 * What the FAQ pages read from the address (ADR-143, frontend.md 6.1): one schema for each page, defaults left out,
 * anything that does not fit dropped instead of refused, so a hand-edited address still shows a page.
 */

/** The public page's address. */
export const FAQ_PATH = "/faq";
/** The admin list's address. */
export const ADMIN_FAQ_PATH = "/admin/faq";

type RawParams = Record<string, string | string[] | undefined>;

/** The first value of a repeated parameter. */
function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const publicSchema = z.object({
  words: z.string().trim().max(FAQ_SEARCH_MAX).catch(""),
  category: z.string().regex(SLUG).max(60).catch(""),
});

/** The words typed and the category chosen on /faq. Words are cut at the search limit; a category must be a slug. */
export type PublicFaqParams = { query: string; category: string };

export function parsePublicFaqParams(raw: RawParams): PublicFaqParams {
  const parsed = publicSchema.parse({
    words: first(raw.q) ?? "",
    category: first(raw.category) ?? "",
  });
  return { query: parsed.words, category: parsed.category };
}

/** The address of the public page for a choice: the words and the category, each left out when empty. */
export function faqHref(choice: { query?: string; category?: string } = {}): string {
  const search = new URLSearchParams();
  if (choice.category) search.set("category", choice.category);
  if (choice.query) search.set("q", choice.query);
  const text = search.toString();
  return text === "" ? FAQ_PATH : `${FAQ_PATH}?${text}`;
}

const adminSchema = z.object({
  view: z.enum(FAQ_ADMIN_VIEWS).catch("all"),
  category: z.uuid().catch(""),
  words: z.string().trim().max(100).catch(""),
});

/** The tab, the category (an id) and the words chosen on the admin list. */
export type AdminFaqParams = { view: FaqAdminViewName; category: string; query: string };

export function parseAdminFaqParams(raw: RawParams): AdminFaqParams {
  const parsed = adminSchema.parse({
    view: first(raw.view) ?? "all",
    category: (first(raw.category) ?? "").toLowerCase(),
    words: first(raw.q) ?? "",
  });
  return { view: parsed.view, category: parsed.category, query: parsed.words };
}

/** The address of the admin list for a choice, with the defaults (all, no category, no words) left out. */
export function adminFaqHref(choice: Partial<AdminFaqParams> = {}): string {
  const search = new URLSearchParams();
  if (choice.view && choice.view !== "all") search.set("view", choice.view);
  if (choice.category) search.set("category", choice.category);
  if (choice.query) search.set("q", choice.query);
  const text = search.toString();
  return text === "" ? ADMIN_FAQ_PATH : `${ADMIN_FAQ_PATH}?${text}`;
}
