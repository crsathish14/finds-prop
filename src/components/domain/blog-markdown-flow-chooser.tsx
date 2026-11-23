/**
 * BlogMethodChooser: the first step of a new article, two ways to start (ADR-172).
 * Purpose: the admin picks the block editor (the form with blocks, ADR-144) or "Paste Markdown" (paste an article written
 *   elsewhere, see it drawn, and make a draft from it). Both stay while the owner tries them; one will be removed. Part of
 *   the Markdown flow's files, so it goes with them. Owner: design system. It keeps nothing.
 * Props: blocksHref and markdownHref (where each card goes; the page keeps the category the list was narrowed to),
 *   className.
 * Responsive: the two cards stack on a phone and sit side by side from the medium width; each card is one 44 px tall
 *   link target or more.
 * Accessibility: each card is a labelled region with its own level-2 heading and a link whose name says what it opens.
 * States: one (nothing to load, nothing to fail).
 * Dependencies: Heading, Text, Button, Link, Icon, next-intl.
 * Tests: blog-markdown-flow.test.tsx; Design Lab "Blog" board (ADR-172).
 * UX reference: none yet; drawn for the owner's approval (ADR-172).
 */
import { Blocks, ClipboardPaste } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type BlogMethodChooserProps = {
  blocksHref: string;
  markdownHref: string;
  className?: string;
};

function BlogMethodChooser({ blocksHref, markdownHref, className }: BlogMethodChooserProps) {
  const translate = useTranslations("admin.blog.chooser");
  return (
    <div
      data-slot="blog-method-chooser"
      className={cn("grid max-w-4xl gap-4 md:grid-cols-2", className)}
    >
      <section
        aria-labelledby="blog-method-blocks"
        className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6"
      >
        <Icon icon={Blocks} />
        <Heading as="h2" size="3" id="blog-method-blocks">
          {translate("blocks.title")}
        </Heading>
        <Text tone="muted" className="flex-1">
          {translate("blocks.description")}
        </Text>
        <div>
          <Button asChild variant="secondary">
            <Link href={blocksHref} variant="nav" className="no-underline">
              {translate("blocks.action")}
            </Link>
          </Button>
        </div>
      </section>
      <section
        aria-labelledby="blog-method-markdown"
        className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6"
      >
        <Icon icon={ClipboardPaste} />
        <Heading as="h2" size="3" id="blog-method-markdown">
          {translate("markdown.title")}
        </Heading>
        <Text tone="muted" className="flex-1">
          {translate("markdown.description")}
        </Text>
        <div>
          <Button asChild variant="secondary">
            <Link href={markdownHref} variant="nav" className="no-underline">
              {translate("markdown.action")}
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

export { BlogMethodChooser };
