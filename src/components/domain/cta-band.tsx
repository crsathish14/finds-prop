/**
 * CtaBand: the green banner that invites a visitor to post a property.
 * Purpose: the last block of the homepage ("Want to sell or rent your property?"). Owner: design
 *   system. It holds no state and fetches nothing: the page passes the words, already translated,
 *   and where the button leads.
 * Props: title, description (left out when missing), actionLabel, href, id (the title's id, so the
 *   section around the banner can be named by it), className.
 * Responsive: stacked on a phone (title, sentence, button); from 768 px the button sits at the
 *   right, centred on the text.
 * Accessibility: the title is a level 2 heading; the button is a link named by its label. The
 *   arches are decoration. White and pale-green text on the forest green passes 4.5 : 1.
 * States: button default, hover, focus, pressed.
 * Dependencies: Button, Link, Heading, Icon, cn.
 * Tests: section-blocks.test.tsx; Design Lab "Domain" (S4-T06).
 * UX reference: home screens, post-property banner (s-home.css .ctaband). The button is copper as
 *   drawn, so the homepage has two copper buttons (this one and Search); the owner approved this on
 *   4 Nov 2026. The UX corners are 28 px and the side padding 48 px; the tokens have 24 px and 40 px.
 */
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";

type CtaBandProps = {
  title: string;
  description?: string | undefined;
  actionLabel: string;
  href: string;
  id?: string | undefined;
  className?: string;
};

function CtaBand({ title, description, actionLabel, href, id, className }: CtaBandProps) {
  return (
    <div
      data-slot="cta-band"
      className={cn(
        "relative flex flex-col items-start gap-5 overflow-hidden rounded-xl bg-primary px-6 py-8 text-on-primary",
        "md:flex-row md:items-center md:justify-between md:px-10 md:py-10",
        className,
      )}
    >
      {/* Three arches, one inside the next, at the bottom right: the ring is 2 px and the two bands
          around it are fainter. A drawing, so the page needs no image file. */}
      <svg
        viewBox="0 0 480 480"
        aria-hidden="true"
        className="pointer-events-none absolute -right-35 -bottom-50 size-120 text-on-primary"
      >
        <path
          d="M0 480V240a240 240 0 0 1 480 0v240ZM80 480V240a160 160 0 0 1 320 0v240Z"
          fill="currentColor"
          fillOpacity="0.03"
          fillRule="evenodd"
        />
        <path
          d="M40 480V240a200 200 0 0 1 400 0v240ZM80 480V240a160 160 0 0 1 320 0v240Z"
          fill="currentColor"
          fillOpacity="0.04"
          fillRule="evenodd"
        />
        <path
          d="M80 480V240a160 160 0 0 1 320 0v240"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="2"
        />
      </svg>
      <div className="relative">
        <Heading as="h2" size="2" id={id} className="text-on-primary">
          {title}
        </Heading>
        {description ? <p className="mt-2 text-body text-on-dark-muted">{description}</p> : null}
      </div>
      <Button asChild variant="accent" size="lg" className="relative">
        <Link href={href} className="text-on-cta no-underline hover:text-on-cta">
          <Icon icon={Plus} />
          {actionLabel}
        </Link>
      </Button>
    </div>
  );
}

export { CtaBand };
