/**
 * StatusBadge: a status as a coloured word with a dot.
 * Purpose: the only way a listing, enquiry or unit status is shown, so a status never has two
 *   colours. Owner: design system. The colour map is src/config/status-map.ts.
 * Props: kind ("listing" | "enquiry" | "unit") and the status for that kind (both typed, so a
 *   status that does not exist fails to compile), className.
 * Responsive: 26 px tall, never wraps.
 * Accessibility: the status is a word as well as a colour and a dot (R-DS-09). The word comes from
 *   en.json (`status.<kind>.<status>`).
 * States: none. Dependencies: Badge, status map, next-intl.
 * Tests: display.test.tsx; Design Lab "Badges" (S2-T07).
 * UX reference: ds-components, Badges and status; design-system.md status colours.
 */
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { STATUS_TONES, type StatusKind, type StatusOf, type StatusTone } from "@/config/status-map";

type StatusBadgeProps = {
  [Kind in StatusKind]: { kind: Kind; status: StatusOf<Kind>; className?: string };
}[StatusKind];

function StatusBadge({ kind, status, className }: StatusBadgeProps) {
  // The key is built from two typed values, so the compiler cannot see it in en.json;
  // check-messages does (dynamic prefix `status.`).
  const translate = useTranslations() as unknown as (key: string) => string;
  const tone = (STATUS_TONES[kind] as Record<string, StatusTone>)[String(status)];
  return (
    <Badge dot tone={tone} className={className}>
      {translate(`status.${kind}.${String(status)}`)}
    </Badge>
  );
}

export { StatusBadge };
