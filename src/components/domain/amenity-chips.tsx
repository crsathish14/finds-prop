/**
 * AmenityChips: a wrapping row of toggle chips to choose any of a list, such as a home's amenities.
 * Purpose: step 2 of the post-property wizard (S6-T02, FR-ACC-06). Owner: design system.
 * Props: label (names the group, already translated), options ({ value, label }), selected (the chosen
 *   values), onToggle (called with the value), disabled, className.
 * Responsive: the chips wrap onto as many lines as they need.
 * Accessibility: a group named by `label`; each chip is a button with aria-pressed (Chip), so the state is
 *   announced and the tick means it is not colour alone.
 * States: none chosen, some chosen, all chosen, disabled. Dependencies: Chip, cn.
 * Tests: wizard.test.tsx; Design Lab "Seller" (S6-T02).
 * UX reference: post-property screen, step 2, Amenities (chip row).
 */
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";

type AmenityOption = { value: string; label: string };

type AmenityChipsProps = {
  label: string;
  options: AmenityOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

function AmenityChips({
  label,
  options,
  selected,
  onToggle,
  disabled = false,
  className,
}: AmenityChipsProps) {
  return (
    <div
      role="group"
      aria-label={label}
      data-slot="amenity-chips"
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((option) => (
        <Chip
          key={option.value}
          type="button"
          selected={selected.includes(option.value)}
          disabled={disabled}
          onClick={() => onToggle(option.value)}
        >
          {option.label}
        </Chip>
      ))}
    </div>
  );
}

export { AmenityChips };
export type { AmenityChipsProps, AmenityOption };
