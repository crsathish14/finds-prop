/**
 * PhoneField: an Indian mobile number input with a fixed +91 prefix inside the field.
 * Purpose: customer sign-in and the enquiry forms. Owner: design system. Put it inside a
 *   FormField. Turn the typed text into +91XXXXXXXXXX with normaliseIndianMobile (src/lib/phone.ts).
 * Props: every Input prop except type and leading.
 * Responsive: as Input (52 px tall, 16 px text).
 * Accessibility: type="tel", inputMode="tel" and autoComplete="tel-national" are set. The prefix is
 *   decoration, so say "+91" in the hint too.
 * States: every Input state. Dependencies: Input.
 * Tests: forms.test.tsx; Design Lab "Fields" (S2-T07).
 * UX reference: ux-addendum design-handoff-addendum, PhoneField.
 */
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type PhoneFieldProps = Omit<ComponentProps<typeof Input>, "type" | "leading">;

function PhoneField({ className, ...props }: PhoneFieldProps) {
  return (
    <Input
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      leading={<span className="text-body font-semibold text-ink">+91</span>}
      className={cn("pl-14", className)}
      {...props}
    />
  );
}

export { PhoneField };
