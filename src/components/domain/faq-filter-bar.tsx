/**
 * FaqFilterBar: the search box and the category chips above the public FAQ.
 * Purpose: let a visitor find a question on /faq (ADR-143). Owner: design system. Both live in the address, so a
 *   search or a category can be shared and works without scripts: the search is a plain form that sends `q` (and the
 *   chosen category) by GET, and each chip is a link. It holds no state: the page passes the words, already
 *   translated, and the addresses.
 * Props: search ({ label, placeholder, submitLabel, value, name (the address's word, "q"), action (the page's
 *   path), hidden: { name, value }[] to keep in the form, such as the chosen category }), categories ({ label (names the
 *   group), all: { label, href, selected }, options: { slug, label, href, selected }[] }), summary (the line under the
 *   bar: "12 questions" or "3 questions for 'sale deed'"), clear ({ label, href } shown while a search or category is
 *   chosen), className.
 * Responsive: the search box and its button share a line from 768 px and stack below; the chips scroll sideways on a
 *   phone rather than wrap, and wrap from 768 px.
 * Accessibility: the form is a search landmark; the box has a label; the chips are links in a labelled list and the
 *   chosen one is marked current and shows a tick, so it is not colour alone; the summary is a polite live region.
 * States: nothing chosen, a category chosen, a search typed, both; one category; many categories; a long category name.
 * Dependencies: Input, Button, Chip, Link, Icon, Text, cn. Tests: faq-parts.test.tsx; Design Lab "Domain" (ADR-143).
 * UX reference: none approved yet; drawn in the Design Lab for the owner to approve (ADR-143).
 */
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type FaqChip = { label: string; href: string; selected: boolean };

type FaqFilterBarProps = {
  search: {
    label: string;
    placeholder: string;
    submitLabel: string;
    value: string;
    name: string;
    action: string;
    hidden?: { name: string; value: string }[];
  };
  categories: {
    label: string;
    all: FaqChip;
    options: (FaqChip & { slug: string })[];
  };
  summary: string;
  clear?: { label: string; href: string };
  className?: string;
};

function CategoryChip({ chip }: { chip: FaqChip }) {
  // A link is not a toggle, so the chip is marked with aria-current (through Link) and a tick, not aria-pressed.
  return (
    <li className="shrink-0">
      <Chip asChild size="sm">
        <Link
          href={chip.href}
          variant="nav"
          current={chip.selected}
          className="no-underline hover:no-underline aria-[current=page]:border-primary aria-[current=page]:bg-primary-tint aria-[current=page]:text-primary"
        >
          {chip.selected ? <Icon icon={Check} size="sm" /> : null}
          {chip.label}
        </Link>
      </Chip>
    </li>
  );
}
function FaqFilterBar({ search, categories, summary, clear, className }: FaqFilterBarProps) {
  return (
    <div data-slot="faq-filter-bar" className={cn("flex flex-col gap-4", className)}>
      <form
        role="search"
        action={search.action}
        method="get"
        className="flex flex-col gap-3 md:flex-row"
      >
        {search.hidden?.map((field) => (
          <input key={field.name} type="hidden" name={field.name} value={field.value} />
        ))}
        <div className="md:grow">
          <Input
            type="search"
            name={search.name}
            aria-label={search.label}
            placeholder={search.placeholder}
            defaultValue={search.value}
            maxLength={200}
            autoComplete="off"
            leading={<Icon icon={Search} />}
          />
        </div>
        <Button type="submit" variant="primary">
          {search.submitLabel}
        </Button>
      </form>
      <nav aria-label={categories.label}>
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden">
          <CategoryChip chip={categories.all} />
          {categories.options.map((option) => (
            <CategoryChip key={option.slug} chip={option} />
          ))}
        </ul>
      </nav>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Text tone="muted" variant="small" role="status" aria-live="polite">
          {summary}
        </Text>
        {clear ? (
          <Link href={clear.href} variant="default" className="text-small">
            {clear.label}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export { FaqFilterBar };
export type { FaqChip, FaqFilterBarProps };
