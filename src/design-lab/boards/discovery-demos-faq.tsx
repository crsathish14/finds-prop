"use client";

import { FaqAccordion, type FaqAccordionGroup } from "@/components/domain/faq-accordion.client";
import { FaqFilterBar, type FaqFilterBarProps } from "@/components/domain/faq-filter-bar";
import { EmptyState } from "@/components/patterns/empty-state";
import { Button } from "@/components/ui/button";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { Specimen } from "../frame";

/**
 * The public FAQ page's parts (ADR-143): the accordion of questions grouped by category, and the search box with the
 * category chips. Plain English text and made-up questions; nothing here goes anywhere. All wording is draft wording for
 * the owner to approve.
 */

const GROUPS: FaqAccordionGroup[] = [
  {
    slug: "buyers",
    name: "Buyers",
    countLabel: "3 questions",
    items: [
      {
        id: "q1",
        question: "How do I contact the owner of a home?",
        paragraphs: [
          "Open the home and choose Contact owner. You sign in with your mobile number first, so owners only hear from real people.",
          "The owner replies by phone. You can see every message you sent under Enquiries.",
        ],
      },
      {
        id: "q2",
        question: "Which papers should I ask to see before I pay anything?",
        paragraphs: [
          "Ask for the sale deed, the latest tax receipt and an encumbrance certificate. Check that the name on the deed matches the person you are speaking to.",
        ],
      },
      {
        id: "q3",
        question: "Can I save homes and compare them later?",
        paragraphs: [
          "Yes. Tap the heart on a home to save it, and add up to four homes to compare.",
        ],
      },
    ],
  },
  {
    slug: "sellers",
    name: "Sellers",
    countLabel: "2 questions",
    items: [
      {
        id: "q4",
        question: "How long does a listing take to go live?",
        paragraphs: [
          "Most listings are reviewed within one working day. You get a message when yours is approved or when we need a change.",
        ],
      },
      {
        id: "q5",
        question: "Is it free to post a property?",
        paragraphs: ["Posting is free. We tell you before anything on the site ever costs money."],
      },
    ],
  },
];

const LONG: FaqAccordionGroup[] = [
  {
    slug: "platform",
    name: "Platform and a very long category name that has to wrap on a narrow phone screen",
    countLabel: "1 question",
    items: [
      {
        id: "q6",
        question:
          "What happens to my details when I delete my account, and how long do you keep a record of the messages I sent to owners and agents?",
        paragraphs: [
          "Supercalifragilisticexpialidocious-and-an-unbroken-reference-number-0123456789-0123456789-0123456789 stays in the page without pushing it wider.",
          "A second paragraph is shown with a blank line between them.\nA single line break inside a paragraph is kept.",
          "A third paragraph, to show the spacing of a long answer.",
        ],
      },
    ],
  },
];

export function FaqAccordionDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The questions of the public FAQ page (ADR-143): a heading and count for each category and an
        accordion of its questions. Several can be open at once. The answers are plain text in
        paragraphs, never HTML. An address ending in a question&apos;s anchor (#faq-q4) opens that
        question and scrolls to it. Made-up questions.
      </Text>
      <Specimen label="Two categories, all closed (try opening one, then another)">
        <div className="w-full max-w-3xl">
          <FaqAccordion groups={GROUPS} />
        </div>
      </Specimen>
      <Specimen label="One question open to start with, as when the address names it">
        <div className="w-full max-w-3xl">
          <FaqAccordion groups={[GROUPS[1] as FaqAccordionGroup]} openIds={["q4"]} />
        </div>
      </Specimen>
      <Specimen label="A very long category name, question and word, with three paragraphs, open">
        <div className="w-full max-w-3xl">
          <FaqAccordion groups={LONG} openIds={["q6"]} />
        </div>
      </Specimen>
    </div>
  );
}

const CATEGORIES = [
  { slug: "buyers", label: "Buyers" },
  { slug: "sellers", label: "Sellers" },
  { slug: "tenants", label: "Tenants" },
  { slug: "property-owners", label: "Property owners" },
  { slug: "agents", label: "Agents" },
  { slug: "platform", label: "Platform" },
];

function bar(overrides: {
  chosen?: string;
  query?: string;
  summary: string;
  categories?: typeof CATEGORIES;
}): FaqFilterBarProps {
  const categories = overrides.categories ?? CATEGORIES;
  const filtering = Boolean(overrides.chosen) || Boolean(overrides.query);
  return {
    search: {
      label: "Search the questions",
      placeholder: "Search questions, such as sale deed",
      submitLabel: "Search",
      value: overrides.query ?? "",
      name: "q",
      action: "#faq",
      hidden: overrides.chosen ? [{ name: "category", value: overrides.chosen }] : [],
    },
    categories: {
      label: "Categories",
      all: { label: "All", href: "#all", selected: !overrides.chosen },
      options: categories.map((category) => ({
        slug: category.slug,
        label: category.label,
        href: `#${category.slug}`,
        selected: overrides.chosen === category.slug,
      })),
    },
    summary: overrides.summary,
    ...(filtering ? { clear: { label: "Clear search and category", href: "#all" } } : {}),
  };
}

export function FaqFilterBarDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Text tone="muted">
        The search box and the category chips above the public FAQ (ADR-143). Both live in the
        address, so a search or a category can be shared and works without scripts: the search is a
        plain form and each chip is a link. The chosen chip shows a tick as well as its fill.
        Made-up questions.
      </Text>
      <Specimen label="Nothing chosen: every category, the count of all questions">
        <div className="w-full max-w-3xl">
          <FaqFilterBar {...bar({ summary: "38 questions" })} />
        </div>
      </Specimen>
      <Specimen label="A category chosen and words typed: the summary says what was found, and Clear shows">
        <div className="w-full max-w-3xl">
          <FaqFilterBar
            {...bar({
              chosen: "buyers",
              query: "sale deed",
              summary: "2 questions for “sale deed” in Buyers",
            })}
          />
        </div>
      </Specimen>
      <Specimen label="Nothing found: the bar stays, and the page shows an empty state under it">
        <div className="flex w-full max-w-3xl flex-col gap-6">
          <FaqFilterBar {...bar({ query: "zzzz", summary: "No questions for “zzzz”" })} />
          <EmptyState
            title="No questions match your search"
            description="Try fewer or different words, or choose another category."
          >
            <Button asChild variant="primary">
              <Link href="#all" variant="nav" className="no-underline">
                Show all questions
              </Link>
            </Button>
          </EmptyState>
        </div>
      </Specimen>
    </div>
  );
}
