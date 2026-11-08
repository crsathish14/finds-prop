"use client";

/**
 * SignInAddress: the address an invited builder signs in at, with a button to copy it.
 * Purpose: after the admin invites a builder (S7-T05), nothing is emailed (DEC-27), so the admin passes the address
 *   on; this shows it and copies it. Owner: design system. It holds only whether the address was just copied: the
 *   page passes the words, already translated.
 * Props: label (names the address), address, copyLabel ("Copy address"), copiedLabel ("Copied"), hint (a line under
 *   it, such as who it is for), className.
 * Responsive: the address and the button on one line from 768 px; the button under the address below that. A long
 *   address breaks anywhere instead of running off the edge.
 * Accessibility: the address is a read-only box with a visible label, so it is read as a field and can also be
 *   copied by hand (it selects itself when focused) when the browser refuses the clipboard; the copy result is
 *   announced politely ("Copied") and also changes the button's label, not only its colour.
 * States: default, copied (for a few seconds), the clipboard not available (nothing happens and the text stays
 *   selectable). Dependencies: Button, Icon, cn. Tests: builder-parts.test.tsx; Design Lab "Admin" (S7-T05).
 * UX reference: none (new with the Google-only invitation, ADR-075).
 */
import { Check, Copy } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type SignInAddressProps = {
  label: string;
  address: string;
  copyLabel: string;
  copiedLabel: string;
  hint?: string;
  className?: string;
};

const COPIED_FOR_MS = 3000;

function SignInAddress({
  label,
  address,
  copyLabel,
  copiedLabel,
  hint,
  className,
}: SignInAddressProps) {
  const boxId = useId();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
    } catch {
      // The browser refused (or has no clipboard): the address stays selectable text.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_FOR_MS);
  }

  return (
    <div data-slot="sign-in-address" className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={boxId} className="text-small font-semibold text-ink">
        {label}
      </label>
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <Input
          id={boxId}
          readOnly
          value={address}
          className="min-w-0 flex-1"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void copy()}
          iconStart={<Icon icon={copied ? Check : Copy} size="sm" />}
        >
          {copied ? copiedLabel : copyLabel}
        </Button>
      </div>
      {hint ? <p className="text-small text-muted">{hint}</p> : null}
      <span role="status" className="sr-only">
        {copied ? copiedLabel : ""}
      </span>
    </div>
  );
}

export { SignInAddress };
export type { SignInAddressProps };
