/**
 * ConversationalHero: the "Conversational" homepage hero (ADR-177): the search bar is the hero.
 * Purpose: a short prompt and a modest headline lead the eye to a wide, centred search bar; the three promises sit
 *   quietly under it, and the sponsored strip rises in last. Owner: design system. It holds no state and fetches
 *   nothing: the page passes the words (already translated) and the search bar as `children`.
 * Props: title (the whole headline), emphasis (the part of the title set in italic copper; it must appear in the
 *   title), subtitle (left out when missing), prompt (the small pill above the headline), trust (up to three short
 *   lines under the search), sponsor (the sponsored strip, already chosen by the page; left out when there is none,
 *   and then the hero leaves no gap), children (the search bar), titleAs ("h1" default), id (the headline's id,
 *   which names the section; "home-hero-title" by default), className.
 * Responsive: one centred column. The search bar is held to the search-card width; the trust lines wrap; the strip
 *   sits in a card from 768 px and bare on a phone.
 * Accessibility: the headline names the section. The prompt pill's icon is decoration. Motion (src/styles/hero-lab.css):
 *   transform and opacity only; with prefers-reduced-motion everything is shown in place and the running light on
 *   the search border stops; the loop pauses while the tab is hidden (the page wraps this in PauseWhenHidden).
 * States: with and without the line under the headline, the copper word, the trust lines and the strip.
 * Dependencies: Container, Heading (TitleWithEmphasis), Icon, cn.
 * Tests: conversational-hero.test.tsx; Design Lab "Domain" (Conversational hero).
 * UX reference: none; the owner's hero lab of 23 Nov 2026 (layout C), a deviation from the approved UX (ADR-177).
 */
import { Columns2, MessageCircle, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { Container } from "@/components/layout/container";
import { Heading, TitleWithEmphasis } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type ConversationalHeroProps = {
  title: string;
  emphasis?: string | undefined;
  subtitle?: string | undefined;
  prompt: string;
  trust?: readonly string[] | undefined;
  sponsor?: ReactNode;
  /** True when the sponsor brings its own frame (the styled hero ads, ADR-190): no white box is drawn round it. */
  sponsorBare?: boolean;
  children: ReactNode;
  titleAs?: "h1" | "h2" | "h3";
  id?: string;
  className?: string;
};

const TRUST_ICONS: readonly LucideIcon[] = [ShieldCheck, MessageCircle, Columns2];

const TITLE_ID = "home-hero-title";

type MotionVariables = CSSProperties & Record<`--hl-${string}`, string | number>;

/** The place of an item in the entrance (src/styles/hero-lab.css, .hl-in and .hl-pop). */
function entranceOrder(index: number): MotionVariables {
  return { "--hl-i": index };
}

function ConversationalHero({
  title,
  emphasis,
  subtitle,
  prompt,
  trust,
  sponsor,
  sponsorBare = false,
  children,
  titleAs = "h1",
  id = TITLE_ID,
  className,
}: ConversationalHeroProps) {
  return (
    <section
      data-slot="home-hero"
      data-layout="conversational"
      aria-labelledby={id}
      className={cn(
        "hl-root relative overflow-hidden pt-6 pb-8 md:pt-10 md:pb-10 lg:pt-14",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-3/4 bg-linear-to-b from-primary-tint to-transparent"
      />
      <Container size="mid" className="relative text-center">
        <p
          className="hl-in inline-flex items-center gap-2 rounded-pill border border-primary-tint-2 bg-surface px-4 py-2 text-caption font-bold text-primary"
          style={entranceOrder(0)}
        >
          <Icon icon={Sparkles} size="sm" />
          {prompt}
        </p>
        <Heading
          as={titleAs}
          size="1"
          id={id}
          className="hl-in mx-auto mt-4 max-w-3xl md:mt-5"
          style={entranceOrder(1)}
        >
          <TitleWithEmphasis title={title} emphasis={emphasis} />
        </Heading>
        {subtitle ? (
          <p
            className="hl-in mx-auto mt-2 max-w-210 text-body text-muted md:mt-3 md:text-lead"
            style={entranceOrder(2)}
          >
            {subtitle}
          </p>
        ) : null}
        <div
          className="hl-in hl-search hl-run mx-auto mt-6 max-w-(--w-search-card) text-left md:mt-8"
          style={entranceOrder(3)}
        >
          {children}
        </div>
        {trust && trust.length > 0 ? (
          <ul
            className="hl-in mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 md:mt-8"
            style={entranceOrder(7)}
          >
            {trust.slice(0, TRUST_ICONS.length).map((line, index) => (
              <li
                key={line}
                className="inline-flex items-center gap-2 text-small font-bold text-primary"
              >
                <Icon icon={TRUST_ICONS[index] ?? ShieldCheck} size="sm" />
                {line}
              </li>
            ))}
          </ul>
        ) : null}
        {sponsor ? (
          <div
            className={cn(
              "hl-late mx-auto mt-8 max-w-(--w-sponsor-strip) md:mt-10",
              !sponsorBare &&
                "md:rounded-xl md:border md:border-line md:bg-surface md:p-4 md:shadow-card",
            )}
            style={entranceOrder(8)}
          >
            {sponsor}
          </div>
        ) : null}
      </Container>
    </section>
  );
}

export { ConversationalHero, entranceOrder };
export type { ConversationalHeroProps };
