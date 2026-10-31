/**
 * FormField: a label, one control, an optional hint and an optional error, wired together.
 * Purpose: every form field on the site, so labels, hints and errors are always connected for
 *   screen readers. Owner: design system. Works with Input, Textarea, NativeSelect, PasswordField,
 *   PhoneField and OtpInput; give it one control as the child.
 * Props: label (required, already-translated), hint, error (already-translated message), required,
 *   optionalLabel (already-translated "(optional)"), id (made for you when left out), className.
 *   It passes id, aria-describedby, aria-invalid and aria-required to the child. It works with
 *   react-hook-form (pass the field error text) and with useActionState field errors.
 * Responsive: stacks label, control, hint, error at every width.
 * Accessibility: the label is tied to the control; the hint and error are listed in
 *   aria-describedby; an error also sets aria-invalid and shows an icon, so it is not colour alone.
 * States: default, hint, error. Dependencies: Label, Icon, cn.
 * Tests: forms.test.tsx; Design Lab "Fields" (S2-T07).
 * UX reference: ds-components, Fields (c-core.css .field, .hint, .error).
 */
import { CircleAlert } from "lucide-react";
import { cloneElement, useId, type ReactElement } from "react";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

type ControlProps = {
  id?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | undefined;
  "aria-required"?: boolean | undefined;
};

type FormFieldProps = {
  label: string;
  children: ReactElement<ControlProps>;
  hint?: string;
  error?: string;
  required?: boolean;
  optionalLabel?: string;
  id?: string;
  className?: string;
};

function FormField({
  label,
  children,
  hint,
  error,
  required,
  optionalLabel,
  id,
  className,
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = id ?? children.props.id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [children.props["aria-describedby"], hintId, errorId]
    .filter(Boolean)
    .join(" ");

  return (
    <div data-slot="form-field" className={cn("flex min-w-0 flex-col gap-2", className)}>
      <Label htmlFor={controlId} required={required} optionalLabel={optionalLabel}>
        {label}
      </Label>
      {cloneElement(children, {
        id: controlId,
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : children.props["aria-invalid"],
        "aria-required": required ? true : children.props["aria-required"],
      })}
      {hint ? (
        <p id={hintId} className="text-caption text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-2 text-caption font-semibold text-danger">
          <Icon icon={CircleAlert} size="sm" className="mt-px" />
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { FormField };
