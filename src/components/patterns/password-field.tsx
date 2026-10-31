"use client";

/**
 * PasswordField: a password input with a show/hide button.
 * Purpose: staff and builder sign-in (customers use phone codes). Owner: design system. Put it
 *   inside a FormField.
 * Props: showLabel and hideLabel (required, already-translated, e.g. "Show password" and "Hide
 *   password"), every Input prop except type.
 * Responsive: the 44 px button sits inside the field on every screen.
 * Accessibility: the button is a toggle (aria-pressed) whose name changes with the state, and it
 *   keeps keyboard focus when pressed. Set autoComplete ("current-password" or "new-password").
 * States: hidden, shown, plus every Input state. Dependencies: Input, IconButton, Icon.
 * Tests: forms.test.tsx; Design Lab "Fields" (S2-T07).
 * UX reference: ds-components, Fields.
 */
import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";

type PasswordFieldProps = Omit<ComponentProps<typeof Input>, "type" | "trailing"> & {
  showLabel: string;
  hideLabel: string;
};

function PasswordField({ showLabel, hideLabel, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <IconButton
          aria-label={visible ? hideLabel : showLabel}
          pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon icon={visible ? EyeOff : Eye} />
        </IconButton>
      }
    />
  );
}

export { PasswordField };
