// @vitest-environment jsdom
import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import { renderWithMessages } from "../../../../tests/render-intl";
import { FaqScreen } from "../faq-screen";
import type { FaqView } from "../view";

const words = en.faq;

const faq = (
  id: string,
  slug: string,
  name: string,
  question: string,
  answer: string,
): FaqView => ({
  id,
  categoryId: `c-${slug}`,
  categorySlug: slug,
  categoryName: name,
  question,
  answer,
  sortOrder: 1,
  updatedAt: "2026-11-20T10:00:00Z",
});

const FAQS = [
  faq(
    "a",
    "buyers",
    "Buyers",
    "How do I contact an owner?",
    "Choose Contact owner.\n\nWe sign you in first.",
  ),
  faq("b", "buyers", "Buyers", "Which papers do I need?", "The sale deed."),
  faq("c", "sellers", "Sellers", "Is posting free?", "Yes."),
];
const CATEGORIES = [
  { slug: "buyers", name: "Buyers" },
  { slug: "sellers", name: "Sellers" },
];

function screenWith(extra: Partial<Parameters<typeof FaqScreen>[0]> = {}) {
  return renderWithMessages(
    <FaqScreen
      faqs={FAQS}
      categories={CATEGORIES}
      params={{ query: "", category: "" }}
      nothingPublished={false}
      {...extra}
    />,
  );
}

describe("FaqScreen (ADR-143): the public FAQ page", () => {
  it("has the one level-1 title, the breadcrumb, the search, the chips and the groups with their counts", () => {
    screenWith();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: words.search.label })).toBeInTheDocument();
    const chips = screen.getByRole("navigation", { name: words.categories.label });
    expect(
      within(chips)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual([words.categories.all, "Buyers", "Sellers"]);
    expect(screen.getByRole("heading", { level: 2, name: "Buyers" })).toBeInTheDocument();
    expect(screen.getByText("2 questions")).toBeInTheDocument();
    expect(screen.getByText("1 question")).toBeInTheDocument();
    expect(screen.getByText("3 questions", { selector: "[role=status]" })).toBeInTheDocument();
  });

  it("puts every answer in the page as plain paragraphs and gives each question its anchor", () => {
    screenWith();
    expect(screen.getByText("Choose Contact owner.")).toBeInTheDocument();
    expect(screen.getByText("We sign you in first.")).toBeInTheDocument();
    expect(document.getElementById("faq-a")).not.toBeNull();
    expect(document.getElementById("faq-c")).not.toBeNull();
  });

  it("describes the questions on the page as FAQPage data, and the same questions only", () => {
    screenWith({ faqs: FAQS.slice(2) });
    const block = document.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(block?.textContent ?? "{}");
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity.map((entry: { name: string }) => entry.name)).toEqual([
      "Is posting free?",
    ]);
  });

  it("links each chip to its own address, keeping the words, and marks the chosen one", () => {
    screenWith({ params: { query: "deed", category: "buyers" }, faqs: [FAQS[1] as FaqView] });
    const chips = screen.getByRole("navigation", { name: words.categories.label });
    expect(within(chips).getByRole("link", { name: words.categories.all })).toHaveAttribute(
      "href",
      "/faq?q=deed",
    );
    const buyers = within(chips).getByRole("link", { name: "Buyers" });
    expect(buyers).toHaveAttribute("href", "/faq?category=buyers&q=deed");
    expect(buyers).toHaveAttribute("aria-current", "page");
    expect(within(chips).getByRole("link", { name: "Sellers" })).toHaveAttribute(
      "href",
      "/faq?category=sellers&q=deed",
    );
  });

  it("says what was found for the words and the category, and offers Clear while something is chosen", () => {
    screenWith({ params: { query: "deed", category: "buyers" }, faqs: [FAQS[1] as FaqView] });
    expect(screen.getByRole("status")).toHaveTextContent("1 question for “deed” in Buyers");
    expect(screen.getByRole("link", { name: words.clear })).toHaveAttribute("href", "/faq");
    expect(screen.getByRole("searchbox")).toHaveValue("deed");
    expect(
      document.querySelector('form[role="search"] input[type="hidden"][name="category"]'),
    ).toHaveAttribute("value", "buyers");
  });

  it("shows no match with a way back, and no structured data, when nothing is found", () => {
    screenWith({ faqs: [], params: { query: "zzzz", category: "" } });
    expect(screen.getByRole("heading", { name: words.noMatches.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.noMatches.showAll })).toHaveAttribute(
      "href",
      "/faq",
    );
    expect(screen.getByRole("status")).toHaveTextContent("0 questions for “zzzz”");
    expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
  });

  it("says there are no questions yet, with a link to contact, and no search, when nothing is published", () => {
    screenWith({ faqs: [], categories: [], nothingPublished: true });
    expect(screen.getByRole("heading", { name: words.empty.title })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: words.help.link })).toHaveAttribute("href", "/contact");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("ends with a line to the contact page", () => {
    screenWith();
    const help = screen.getByRole("complementary", { name: words.help.title });
    expect(within(help).getByRole("link", { name: words.help.link })).toHaveAttribute(
      "href",
      "/contact",
    );
  });
});
