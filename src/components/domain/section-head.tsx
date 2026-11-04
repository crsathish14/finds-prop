/**
 * SectionHead: the title row above a section of the homepage.
 * Purpose: one place for a section's heading, the line under it and the link or buttons at its
 *   right ("See all localities", the arrows of a scroller). Owner: design system. It holds no
 *   state and fetches nothing: the page passes the words, already translated.
 * Props: title, emphasis (the part of the title to set in copper italic, as "Find Prop" in "Why
 *   Find Prop"; it must appear in the title, otherwise the title is plain), description (the line under the title; left out when missing), action (a
 *   `Link variant="arrow"`, buttons or anything else for the right end; left out when missing),
 *   as ("h2" default | "h3"), id (so a section can name itself with aria-labelledby), className.
 * Responsive: 18 px below the title on a phone and 24 px from 768 px; the title steps up through
 *   the heading tokens. The action drops under a long title instead of squeezing it.
 * Accessibility: a real heading, so the page outline is the section titles. Choose `as` to fit the
 *   outline; do not skip levels. The emphasised words use the copper text colour, which passes 4.5 : 1
 *   at the heading's phone size (23 px is small text); the fill copper of `Heading.Em` does not,
 *   which is why that is for display and h1 sizes only.
 * States: default only.
 * Dependencies: Heading, Text, cn.
 * Tests: section-blocks.test.tsx; Design Lab "Domain" (S4-T06).
 * UX reference: home screens, section heads (s-home.css .sect-head, fp.js homeBelow). The UX gap
 *   under the title is 18 px; the spacing scale has 16 px, which is used on a phone. The UX draws
 *   the emphasised words in the fill copper (about 4.2 : 1 on the page); here they are the copper
 *   text colour, a shade darker.
 */
import type { ReactNode } from "react";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type SectionHeadProps = {
  title: string;
  emphasis?: string | undefined;
  description?: string | undefined;
  action?: ReactNode;
  as?: "h2" | "h3" | undefined;
  id?: string | undefined;
  className?: string;
};

/**
 * The title with the named part in copper italic. It is the same rule as the hero's and the error
 * screen's (the part must be in the title, so the title is one message and can be worded in any
 * order), but in the copper text colour, which passes 4.5 : 1 at this heading's phone size; the
 * fill copper of `Heading.Em` does not.
 */
function TitleWithEmphasized({
  title,
  emphasis,
}: {
  title: string;
  emphasis?: string | undefined;
}) {
  const at = emphasis ? title.indexOf(emphasis) : -1;
  if (!emphasis || at < 0) return title;
  return (
    <>
      {title.slice(0, at)}
      <em className="font-display font-normal text-cta-text italic">{emphasis}</em>
      {title.slice(at + emphasis.length)}
    </>
  );
}

function SectionHead({
  title,
  emphasis,
  description,
  action,
  as = "h2",
  id,
  className,
}: SectionHeadProps) {
  return (
    <div
      data-slot="section-head"
      className={cn("mb-4 flex flex-wrap items-baseline justify-between gap-4 md:mb-6", className)}
    >
      <div className="min-w-0">
        <Heading as={as} size="2" id={id}>
          <TitleWithEmphasized title={title} emphasis={emphasis} />
        </Heading>
        {description ? (
          <Text tone="muted" className="mt-1">
            {description}
          </Text>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export { SectionHead };
