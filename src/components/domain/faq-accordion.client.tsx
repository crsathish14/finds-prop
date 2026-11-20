"use client";

/**
 * FaqAccordion: the public FAQ's questions, grouped by category, each opening to its answer.
 * Purpose: the body of the /faq page (ADR-143): a heading and count per category and an accordion of its questions.
 *   Owner: design system. It keeps no state: the questions are native details elements, so the browser holds which are
 *   open, and the only script opens the one an address names. The page passes the groups, already translated, and
 *   the answers already split into paragraphs of plain text (never HTML). Every question has the anchor `faq-<id>`;
 *   an address ending in it (a link from the AI assistant or a shared link) opens that question and scrolls to it.
 * Props: groups ({ slug, name, countLabel, items: { id, question, paragraphs }[] }[]; the groups and the questions
 *   come in the order to show), openIds (questions open to start with; the page passes none), className.
 * Responsive: one column at every width; each group is a card; a long question wraps and a long word breaks.
 * Accessibility: each category is a level-2 heading naming its region; each question is a summary (a button that
 *   announces expanded or collapsed) holding a level-3 heading; answers stay in the page when closed, so they are read by
 *   search engines and found by the browser; the opened-by-address question moves into view.
 * States: all closed, some open, one opened by its anchor, one category, many categories, a long question and a long
 *   answer with several paragraphs. An empty list is the page's EmptyState.
 * Dependencies: Accordion, Heading, Text, cn. Tests: faq-parts.test.tsx; Design Lab "Domain" (ADR-143).
 * UX reference: none approved yet; drawn in the Design Lab for the owner to approve (ADR-143).
 */
import { useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/patterns/accordion";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type FaqAccordionItem = { id: string; question: string; paragraphs: string[] };

type FaqAccordionGroup = {
  slug: string;
  name: string;
  /** "12 questions". */
  countLabel: string;
  items: FaqAccordionItem[];
};

type FaqAccordionProps = {
  groups: FaqAccordionGroup[];
  openIds?: string[];
  className?: string;
};

const ANCHOR = /^#faq-(.+)$/;

/** The anchor of a question: `faq-<id>`. */
const anchorOf = (id: string): string => ["faq", id].join("-");

/** The question an address points at (`#faq-<id>`), if the page has it. */
function idFromHash(hash: string, groups: FaqAccordionGroup[]): string | null {
  const wanted = ANCHOR.exec(hash)?.[1];
  if (!wanted) return null;
  return groups.some((group) => group.items.some((item) => item.id === wanted)) ? wanted : null;
}

function FaqAccordion({ groups, openIds = [], className }: FaqAccordionProps) {
  useEffect(() => {
    function openFromAddress() {
      const wanted = idFromHash(window.location.hash, groups);
      if (!wanted) return;
      const item = document.getElementById(anchorOf(wanted));
      if (!item) return;
      if (item instanceof HTMLDetailsElement) item.open = true;
      item.scrollIntoView({ block: "start" });
    }
    openFromAddress();
    window.addEventListener("hashchange", openFromAddress);
    return () => window.removeEventListener("hashchange", openFromAddress);
  }, [groups]);

  return (
    <div data-slot="faq-accordion" className={cn("flex flex-col gap-8", className)}>
      {groups.map((group) => {
        const headingId = ["faq", "group", group.slug].join("-");
        return (
          <section key={group.slug} aria-labelledby={headingId} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <Heading as="h2" size="3" id={headingId} className="scroll-mt-24">
                {group.name}
              </Heading>
              <Text tone="muted" variant="small">
                {group.countLabel}
              </Text>
            </div>
            <Accordion className="rounded-xl border border-line bg-surface px-4 md:px-6">
              {group.items.map((item) => (
                <AccordionItem
                  key={item.id}
                  id={anchorOf(item.id)}
                  open={openIds.includes(item.id)}
                >
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>
                    {item.paragraphs.map((paragraph, index) => (
                      <p key={index} className="[overflow-wrap:anywhere] whitespace-pre-line">
                        {paragraph}
                      </p>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        );
      })}
    </div>
  );
}
export { FaqAccordion };
export type { FaqAccordionGroup, FaqAccordionItem, FaqAccordionProps };
