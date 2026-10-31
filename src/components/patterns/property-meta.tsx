/**
 * PropertyMeta: the short line of facts under a property title: 3 BHK · 2 baths · 1,450 sq.ft · Semi-furnished.
 * Purpose: one place that decides which facts show and in what order. Owner: design system.
 * Props: bedrooms, bathrooms, areaSqft (numbers), furnishing and propertyType (already-translated
 *   words), className. Anything missing is left out, never shown blank or as zero.
 * Responsive: wraps onto a second line on narrow cards.
 * Accessibility: a list of plain text items; the dots between them are decoration.
 * States: none. Dependencies: format helpers, next-intl.
 * Tests: display.test.tsx; Design Lab "Card parts" (S2-T07).
 * UX reference: ds-components, property card (c-cards.css).
 */
import { useLocale, useTranslations } from "next-intl";
import { formatArea, type Translate } from "@/lib/format";
import { cn } from "@/lib/cn";

type PropertyMetaProps = {
  bedrooms?: number | null | undefined;
  bathrooms?: number | null | undefined;
  areaSqft?: number | null | undefined;
  furnishing?: string | null | undefined;
  propertyType?: string | null | undefined;
  className?: string;
};

function PropertyMeta({
  bedrooms,
  bathrooms,
  areaSqft,
  furnishing,
  propertyType,
  className,
}: PropertyMetaProps) {
  const translate = useTranslations() as unknown as Translate;
  const locale = useLocale();
  const facts = [
    bedrooms ? translate("property.bhk", { count: bedrooms }) : null,
    bathrooms ? translate("property.bath", { count: bathrooms }) : null,
    areaSqft ? formatArea(translate, locale, areaSqft) : null,
    furnishing || null,
    propertyType || null,
  ].filter((fact): fact is string => fact !== null);

  if (facts.length === 0) return null;
  return (
    <ul
      data-slot="property-meta"
      className={cn("flex flex-wrap gap-x-2 text-small text-muted", className)}
    >
      {facts.map((fact, index) => (
        <li
          key={fact}
          className={cn(index > 0 && "before:mr-2 before:content-['·'] before:text-line-strong")}
        >
          {fact}
        </li>
      ))}
    </ul>
  );
}

export { PropertyMeta };
