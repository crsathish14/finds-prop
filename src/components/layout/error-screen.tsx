/**
 * ErrorScreen: the full-page message for "page not found" and "something went wrong".
 * Purpose: one layout for the not-found and error pages (and the last-resort versions that bypass
 *   the site layout), so they look the same everywhere. Owner: design system. It shows words; the
 *   caller supplies them already translated.
 * Props: code (the small copper line above the title, e.g. "Error 404"), title, emphasis (a part of
 *   the title to set in italic copper; it must appear in the title, otherwise it is ignored),
 *   description, actions (Buttons or Links, usually one primary and one secondary), details ({ summary,
 *   text } shown in a fold-out "Technical details", such as the support reference), as ("main" by
 *   default; "div" when it sits inside a page that already has a main), titleAs (heading level of the
 *   title, "h1" by default; lower when shown inside another page), className.
 * Responsive: centred, at least 60% of the screen tall; the text is capped at 46 characters wide and
 *   the buttons stack on phones.
 * Accessibility: the title is the page's h1 (a main landmark with id="main" for the skip link); the
 *   drawing is hidden from screen readers; the details are a native fold-out, reachable by keyboard.
 * States: not found, error (with and without details). Dependencies: ArchIllustration, Heading, Text, cn.
 * Tests: error-screen.test.tsx; Design Lab "Navigation" (S2-T07).
 * UX reference: errors screen (not found, something went wrong).
 */
import type { ReactNode } from "react";
import { ArchIllustration } from "@/components/ui/arch-illustration";
import { Heading, TitleWithEmphasis } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type ErrorScreenProps = {
  code: string;
  title: string;
  emphasis?: string;
  description: string;
  actions?: ReactNode;
  details?: { summary: string; text: string };
  as?: "main" | "div";
  /** The heading level of the title: "h1" for a whole page, lower when shown inside another page. */
  titleAs?: "h1" | "h2" | "h3";
  className?: string;
};

function ErrorScreen({
  code,
  title,
  emphasis,
  description,
  actions,
  details,
  as: Tag = "main",
  titleAs = "h1",
  className,
}: ErrorScreenProps) {
  return (
    <Tag
      {...(Tag === "main" ? { id: "main" } : {})}
      data-slot="error-screen"
      className={cn(
        "mx-auto grid min-h-[60vh] w-full max-w-3xl flex-1 place-items-center px-gutter py-14 text-center",
        className,
      )}
    >
      <div className="flex flex-col items-center">
        <ArchIllustration className="mb-5 h-38 w-30" />
        <Text as="span" variant="overline" tone="accent">
          {code}
        </Text>
        <Heading as={titleAs} size="1" className="mt-2">
          <TitleWithEmphasis title={title} emphasis={emphasis} />
        </Heading>
        <Text variant="lead" className="mt-3 max-w-[46ch]">
          {description}
        </Text>
        {actions ? <div className="mt-6 flex flex-col gap-3 md:flex-row">{actions}</div> : null}
        {details ? (
          <details className="mt-6 w-full max-w-lg rounded-lg border border-line bg-surface px-5 py-4 text-left">
            <summary className="cursor-pointer text-small font-semibold text-primary underline decoration-line-strong underline-offset-4">
              {details.summary}
            </summary>
            <p className="mt-2 text-small break-all text-muted">
              <code>{details.text}</code>
            </p>
          </details>
        ) : null}
      </div>
    </Tag>
  );
}

export { ErrorScreen };
