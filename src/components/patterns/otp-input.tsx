"use client";

/**
 * OtpInput: a one-time code entered into one real input, shown as separate cells.
 * Purpose: the 6-digit sign-in code. Owner: design system. Put it inside a FormField so it has a
 *   label; the resend timer and the verify call belong to the sign-in feature.
 * Props: length (6 by default), value and onValueChange (controlled) or neither (it keeps its own
 *   value), onComplete (called once when the last digit is entered), invalid, disabled, id and the
 *   aria props that FormField passes.
 * Responsive: cells are 52 px tall and share the width.
 * Accessibility: for screen readers it is one labelled field, not six; the cells are hidden from
 *   them. inputMode="numeric", autoComplete="one-time-code" and maxLength are set, so phones offer
 *   the code from the SMS. Pasting a whole code fills every cell.
 * States: empty, typing, filled, invalid, disabled. Dependencies: cn.
 * Tests: forms.test.tsx; Design Lab "Fields" (S2-T07).
 * UX reference: ux-addendum design-handoff-addendum, OtpInput.
 */
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

type OtpInputProps = Omit<
  ComponentProps<"input">,
  "ref" | "value" | "defaultValue" | "onChange" | "maxLength" | "type"
> & {
  length?: number;
  value?: string;
  onValueChange?: (value: string) => void;
  onComplete?: (value: string) => void;
  invalid?: boolean;
};

function OtpInput({
  length = 6,
  value,
  onValueChange,
  onComplete,
  invalid,
  disabled,
  className,
  ...props
}: OtpInputProps) {
  const [ownValue, setOwnValue] = useState("");
  const current = value ?? ownValue;
  const cells = Array.from({ length }, (_, index) => current[index] ?? "");
  const nextEmpty = Math.min(current.length, length - 1);

  function update(raw: string) {
    const next = raw.replace(/\D/g, "").slice(0, length);
    setOwnValue(next);
    onValueChange?.(next);
    if (next.length === length) onComplete?.(next);
  }

  return (
    <div
      data-slot="otp-input"
      className={cn("group relative grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }}
    >
      {cells.map((digit, index) => (
        <span
          // The cells are decoration; position is their only identity.
          key={index}
          aria-hidden="true"
          data-active={index === nextEmpty}
          className={cn(
            "grid min-h-(--size-control) place-items-center rounded-md group-has-[input:focus-visible]:data-[active=true]:border-primary group-has-[input:focus-visible]:data-[active=true]:outline-2 group-has-[input:focus-visible]:data-[active=true]:outline-offset-1 border-[length:var(--bw-field)] border-line-input bg-surface text-h3 font-semibold text-ink",
            invalid && "border-[length:var(--bw-error)] border-danger",
            disabled && "border-line-strong bg-canvas-sunken text-muted",
          )}
        >
          {digit}
        </span>
      ))}
      <input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={length}
        disabled={disabled}
        aria-invalid={invalid || props["aria-invalid"]}
        value={current}
        onChange={(event) => update(event.target.value)}
        // A pasted code such as "987 654" would be cut short by maxLength before onChange sees it.
        onPaste={(event) => {
          event.preventDefault();
          update(event.clipboardData.getData("text"));
        }}
        className="absolute inset-0 size-full cursor-text opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  );
}

export { OtpInput };
