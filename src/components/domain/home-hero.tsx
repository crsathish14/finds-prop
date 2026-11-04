/**
 * HomeHero: the top of the homepage: the headline, a line under it and the search card.
 * Purpose: the first thing a visitor sees ("Find the place that fits your life"), with the search
 *   card directly under it. Owner: design system. It holds no state and fetches nothing: the page
 *   passes the words (from the site content or the message catalogue, already translated) and the
 *   search card as `children`. It is the "Search Desk" layout without a sponsor strip: the strip
 *   joins under the card in S4-T07, and the "Split" layout is built then too.
 * Props: title (the whole headline), emphasis (the part of the title to set in italic copper, such
 *   as the region's name; it must appear in the title, otherwise the title is plain), subtitle (the
 *   line under the headline; left out when missing), children (the search card), titleAs ("h1"
 *   default; lower when the hero is shown inside another page, as in the Design Lab), id (the
 *   headline's id, which names the section; "home-hero-title" by default, so give each hero on one
 *   page its own), className.
 * Responsive: on a phone the text is on the left and the card fills the width; from 768 px the text
 *   is centred, the headline is held to about two lines and the card is centred at 970 px at most.
 *   The headline and the line step up through the type tokens.
 * Accessibility: the headline is the page's h1 and names the section. The arches behind are
 *   decoration and hidden from screen readers. The copper word is display-size text (30 px and
 *   up), so it passes the large-text contrast limit.
 * States: with and without the copper word, with and without the line; long headline (it wraps).
 * Dependencies: Container, Heading (TitleWithEmphasis), cn.
 * Tests: home-hero.test.tsx; Design Lab "Domain" (S4-T06) and the hero previews.
 * UX reference: home-none (no-sponsor fallback of home-a): .hero-a, .hero h1, .sub, fp-arches. The UX
 *   breaks the headline by hand after "fits"; here the headline is balanced and held to a width, so
 *   a longer or shorter headline wraps well too. The line is 16 px on a phone (UX 15 px), and the
 *   gaps follow the 4 px scale (UX 10 px and 22 px).
 */
import type { ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { Heading, TitleWithEmphasis } from "@/components/ui/heading";
import { cn } from "@/lib/cn";

type HomeHeroProps = {
  title: string;
  emphasis?: string | undefined;
  subtitle?: string | undefined;
  children: ReactNode;
  titleAs?: "h1" | "h2" | "h3";
  id?: string;
  className?: string;
};

const TITLE_ID = "home-hero-title";

/** The path of one half-circle: from its left foot up over the top and down to its right foot. */
function archPath(centreX: number, centreY: number, radius: number): string {
  return ["M", centreX - radius, centreY, "a", radius, radius, 0, 0, 1, radius * 2, 0].join(" ");
}

/**
 * Three half-circles of growing size at the left and at the right, drawn very faintly in the
 * brand green. The picture keeps its shape and is cropped, never squeezed, as the box changes.
 */
function Arches() {
  const rings = [250, 190, 130] as const;
  const arcs = (centreX: number, centreY: number) =>
    rings.map((radius) => (
      <path key={[centreX, radius].join("-")} d={archPath(centreX, centreY, radius)} />
    ));
  return (
    <svg
      viewBox="0 0 1440 520"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 size-full text-primary"
      fill="none"
      stroke="currentColor"
      strokeOpacity="0.08"
      strokeWidth="2"
    >
      {arcs(80, 470)}
      {arcs(1360, 430)}
    </svg>
  );
}

function HomeHero({
  title,
  emphasis,
  subtitle,
  children,
  titleAs = "h1",
  id = TITLE_ID,
  className,
}: HomeHeroProps) {
  return (
    <section
      data-slot="home-hero"
      aria-labelledby={id}
      className={cn("relative overflow-hidden pt-2 pb-6 md:pt-4 md:text-center", className)}
    >
      <Arches />
      <Container className="relative">
        <Heading as={titleAs} size="display" id={id} className="md:mx-auto md:max-w-3xl">
          <TitleWithEmphasis title={title} emphasis={emphasis} />
        </Heading>
        {subtitle ? (
          <p className="mt-2 text-body text-muted md:mx-auto md:mt-3 md:max-w-210 md:text-lead">
            {subtitle}
          </p>
        ) : null}
        <div className="mt-4 md:mx-auto md:mt-6 md:max-w-(--w-search-card)">{children}</div>
      </Container>
    </section>
  );
}

export { HomeHero };
