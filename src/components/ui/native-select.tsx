/**
 * NativeSelect: a dropdown that uses the browser's own picker.
 * Purpose: short lists (property type, bedrooms, budget). On phones the native picker is the best
 *   experience. Owner: design system. For options that need rich content use a custom listbox.
 * Props: invalid (sets aria-invalid), className (applies to the select), native select props;
 *   children are <option> elements whose text is already translated.
 * Responsive: 52 px tall, full width of its container.
 * Accessibility: a real select, so keyboard and screen reader behaviour is the browser's. Pair it
 *   with a Label.
 * States: default, hover, focus, error, disabled.
 * Dependencies: cn, Icon. Tests: inputs.test.tsx; Design Lab "Fields" (S2-T07).
 * UX reference: ds-components, Fields (c-core.css .select).
 */
import { ChevronDown } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

type NativeSelectProps = Omit<ComponentProps<"select">, "ref"> & { invalid?: boolean };

function NativeSelect({ className, invalid, ...props }: NativeSelectProps) {
  return (
    <div className="relative w-full" data-slot="native-select">
      <select
        aria-invalid={invalid || props["aria-invalid"]}
        className={cn(
          "min-h-(--size-control) w-full min-w-0 cursor-pointer appearance-none rounded-md border-[length:var(--bw-field)] border-line-input bg-surface pr-10 pl-4",
          "text-body font-medium text-ink transition-colors duration-(--dur-fast) hover:border-primary",
          "focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-1",
          "aria-invalid:border-[length:var(--bw-error)] aria-invalid:border-danger",
          "disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-canvas-sunken disabled:text-muted",
          className,
        )}
        {...props}
      />
      <Icon
        icon={ChevronDown}
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

export { NativeSelect };
