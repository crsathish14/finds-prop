/**
 * ContactEmailCard: where an owner adds or changes the email enquiries about their homes are mailed to.
 * Purpose: the dashboard note "Add your email to get enquiries by email" for an owner who has homes and no address,
 *   and the same card with the saved address and a Change button once there is one (ADR-184). Owner: design system.
 *   It holds no state and sends nothing: the connected card on the dashboard keeps the text, calls the action and
 *   decides which state to draw.
 * Props: email (the saved address, or null when none), editing (show the box even though an address is saved),
 *   value (what is typed), onValueChange, error (already-translated problem with the address), failure (an
 *   already-translated problem that is not about the address), busy (a save is on its way), onSubmit, onChange
 *   (Change was pressed), onCancel (Cancel was pressed), className.
 * Responsive: a card that fills its container; the box and its buttons sit beside the words from 1024 px and stack
 *   below them on smaller screens.
 * Accessibility: a labelled section; the box has a visible label and the hint and the error are listed in its
 *   aria-describedby (FormField); a refusal is announced as an alert; Change and Cancel are named by their words.
 * States: no address (the prompt), address saved, changing it, saving, an invalid address, a failed save.
 * Dependencies: FormField, Input, Button, Alert, Heading, Text, next-intl. Tests: contact-email-card.test.tsx;
 *   Design Lab "Contact email card" (ADR-184).
 * UX reference: none yet; drawn from the email prompt of ADD-03 for the owner's approval.
 */
import { useTranslations } from "next-intl";
import { useId, type FormEvent } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";

type ContactEmailCardProps = {
  email: string | null;
  editing?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  error?: string | undefined;
  failure?: string | undefined;
  busy?: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onChange: () => void;
  onCancel: () => void;
  className?: string;
};

function ContactEmailCard({
  email,
  editing = false,
  value,
  onValueChange,
  error,
  failure,
  busy = false,
  onSubmit,
  onChange,
  onCancel,
  className,
}: ContactEmailCardProps) {
  const translate = useTranslations("domain.contactEmailCard");
  const titleId = useId();
  const showBox = email === null || editing;
  const title =
    email === null
      ? translate("promptTitle")
      : editing
        ? translate("changeTitle")
        : translate("savedTitle", { email });
  return (
    <section
      data-slot="contact-email-card"
      data-state={email === null ? "prompt" : editing ? "changing" : "saved"}
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-line-strong bg-surface p-5 lg:flex-row lg:items-start lg:justify-between",
        className,
      )}
    >
      <div className="min-w-0 lg:max-w-md">
        <Heading as="h2" size="3" id={titleId} className="break-words">
          {title}
        </Heading>
        <Text tone="muted" className="mt-1">
          {email === null || editing ? translate("promptBody") : translate("savedBody")}
        </Text>
      </div>
      {showBox ? (
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-3 lg:w-96">
          <FormField
            label={translate("label")}
            hint={translate("hint")}
            {...(error ? { error } : {})}
          >
            <Input
              name="contactEmail"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={translate("placeholder")}
              disabled={busy}
              value={value}
              onChange={(event) => onValueChange(event.target.value)}
            />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" variant="accent" loading={busy} disabled={busy}>
              {busy ? translate("saving") : translate("save")}
            </Button>
            {editing ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={onCancel}>
                {translate("cancel")}
              </Button>
            ) : null}
          </div>
          {failure ? <Alert tone="danger">{failure}</Alert> : null}
        </form>
      ) : (
        <Button type="button" variant="secondary" onClick={onChange}>
          {translate("change")}
        </Button>
      )}
    </section>
  );
}

export { ContactEmailCard };
export type { ContactEmailCardProps };
