/**
 * HomeSection: one band of the homepage below the hero, with its own spacing and page width.
 * Purpose: every homepage section (Explore by locality, Featured homes, New launches, Browse by what
 *   matters, Newest, Why Find Prop, the banner) sits in one, so the gaps between sections and the
 *   line-up with the header and footer are the same everywhere. Owner: design system. It holds no
 *   words and fetches nothing.
 * Props: labelledBy (the id of the section's heading, which names it), tone ("default" the page
 *   colour | "band" the slightly darker band the UX gives New launches), spacing ("normal" 36 px
 *   above and below on a phone, 52 px from 768 px and 64 px from 1024 px | "tight" 24 px, then 32 px
 *   from 1024 px), children, className.
 * Responsive: the spacing steps up with the screen; the content has the page's side padding.
 * Accessibility: a labelled region, so a screen reader user can jump between the sections by name.
 *   A section with nothing to show is not rendered at all (the page leaves it out), so no empty
 *   region and no gap is left.
 * States: default and band; normal and tight spacing.
 * Dependencies: Container, cn.
 * Tests: home-section.test.tsx; Design Lab "Domain" (S4-T06).
 * UX reference: home screens, shared sections (base.css .section, s-home.css .section.tight and .band).
 */
import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { cn } from "@/lib/cn";

type HomeSectionProps = {
  labelledBy: string;
  tone?: "default" | "band";
  spacing?: "normal" | "tight";
  children: ReactNode;
  className?: string;
};

function HomeSection({
  labelledBy,
  tone = "default",
  spacing = "normal",
  children,
  className,
}: HomeSectionProps) {
  return (
    <section
      data-slot="home-section"
      data-tone={tone}
      aria-labelledby={labelledBy}
      className={cn(
        spacing === "tight" ? "py-6 lg:py-8" : "py-section",
        tone === "band" ? "bg-canvas-sunken" : "",
        className,
      )}
    >
      <Container>{children}</Container>
    </section>
  );
}

export { HomeSection };
