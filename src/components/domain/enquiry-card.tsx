"use client";

/**
 * EnquiryCard: the box on a property page where a visitor contacts the owner, in each of its states.
 * Purpose: asks a signed-out visitor to sign in, takes an enquiry from a signed-in one, and confirms it
 *   was sent. Owner: design system. It is the screen only: it holds what the visitor has typed and
 *   hands the values over; it sends nothing (the enquiry action is Stage 5). The page chooses the
 *   state and gives it the error words, already translated.
 * Props: state ("signed_out" the gate | "form" the enquiry form | "sent" the confirmation), signInHref,
 *   createAccountHref (the gate's two links), enquiriesHref ("View my enquiries" after sending),
 *   values ({ name, phone, email, message } to start with), errors ({ name, phone, email, message }:
 *   already-translated messages; a field with one is marked invalid), failed (draws the "could not
 *   send" alert above the form; the typed values stay), submitting (the button shows it is working
 *   and ignores clicks), onSubmit (called with the values when the form is sent), variant ("card" the
 *   box beside the details, with its heading, the email field and the message counter | "sheet" the
 *   phone version inside the enquiry sheet: no heading, no email, a shorter message box), headingAs
 *   ("h2" default | "h3"), className.
 * Responsive: full width of its box. The fields stack at every width; the button is as wide as the box.
 * Accessibility: each field has a label and an error tied to it (aria-describedby, aria-invalid, with an
 *   icon, so colour is not the only signal); required fields are marked. When errors appear after the
 *   form is shown, focus moves to the first field with one. The send-failed alert is role="alert". The
 *   confirmation is role="status". The message counter is a polite live region.
 * States: signed out; form (empty, filled); errors on the name and phone; send failed (values kept);
 *   sending; sent; the card and the sheet variants; loading (EnquiryCardSkeleton: the form's box,
 *   hidden from screen readers, shown while the sign-in is checked).
 * Dependencies: FormField, Input, Textarea, Alert, Button, Link, Icon, Skeleton, next-intl, cn.
 * Tests: enquiry-card.test.tsx; Design Lab "Domain" (S4-T01).
 * UX reference: property screen, enquiry card and sheet (s-browse.css .enq-card, .gate, .success-box).
 *   The phone is a plain number of 6 to 15 digits, as the UX draws it and as the database accepts it
 *   (not the +91 field of the sign-in screens). The UX corners are 22 px and the padding 22 px; here
 *   24 px and 24 px.
 */
import { CircleCheck, Lock, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

type EnquiryValues = { name: string; phone: string; email: string; message: string };
type EnquiryField = keyof EnquiryValues;
type EnquiryErrors = Partial<Record<EnquiryField, string>>;

type EnquiryCardProps = {
  state: "signed_out" | "form" | "sent";
  signInHref?: string;
  createAccountHref?: string;
  enquiriesHref?: string;
  values?: Partial<EnquiryValues>;
  errors?: EnquiryErrors;
  failed?: boolean;
  submitting?: boolean;
  onSubmit?: (values: EnquiryValues) => void;
  variant?: "card" | "sheet";
  headingAs?: "h2" | "h3";
  className?: string;
};

const MESSAGE_LIMIT = 1000;
const FIELD_ORDER: readonly EnquiryField[] = ["name", "phone", "email", "message"];

/** The error prop of a field, only when it has an error (the field takes no undefined). */
function errorProp(errors: EnquiryErrors | undefined, field: EnquiryField): { error?: string } {
  const message = errors?.[field];
  return message ? { error: message } : {};
}

/** The round tile behind an icon, the same look as the confirm dialog’s. */
function IconDisc({ tone, children }: { tone: "info" | "success"; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-12 place-items-center rounded-pill",
        tone === "info" ? "bg-info-tint text-info" : "bg-success-tint text-success",
      )}
    >
      {children}
    </span>
  );
}

function EnquiryCard({
  state,
  signInHref = "#",
  createAccountHref = "#",
  enquiriesHref = "#",
  values,
  errors,
  failed = false,
  submitting = false,
  onSubmit,
  variant = "card",
  headingAs: Heading = "h2",
  className,
}: EnquiryCardProps) {
  const translate = useTranslations("domain.enquiry");
  const sheet = variant === "sheet";
  const [typed, setTyped] = useState<EnquiryValues>({
    name: values?.name ?? "",
    phone: values?.phone ?? "",
    email: values?.email ?? "",
    message: values?.message ?? "",
  });
  const form = useRef<HTMLFormElement>(null);
  const shown = useRef(false);

  // Errors that arrive after the form is shown take the reader to the first field with one. Errors
  // that are there from the start (the Design Lab shows them) do not steal focus.
  useEffect(() => {
    if (!shown.current) {
      shown.current = true;
      return;
    }
    const first = FIELD_ORDER.find((field) => errors?.[field]);
    if (first) form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [errors]);

  function change(field: EnquiryField, value: string) {
    setTyped((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    onSubmit?.(typed);
  }

  const frame = cn(
    "rounded-xl border border-line bg-surface p-6",
    sheet ? "border-0 p-0" : "shadow-card",
    className,
  );

  if (state === "signed_out") {
    return (
      <div data-slot="enquiry-card" data-state="signed_out" className={frame}>
        <IconDisc tone="info">
          <Icon icon={Lock} size="lg" />
        </IconDisc>
        <Heading className="mt-3 text-h3 text-primary">{translate("gate.title")}</Heading>
        <p className="mt-2 mb-4 text-small text-muted">{translate("gate.leadIn")}</p>
        <div className="flex flex-col gap-3">
          <Button asChild variant="accent" className="w-full">
            <Link href={signInHref} className="text-on-cta no-underline hover:text-on-cta">
              {translate("gate.signIn")}
            </Link>
          </Button>
          <Button asChild variant="secondary" className="w-full">
            <Link href={createAccountHref} className="text-primary no-underline hover:text-primary">
              {translate("gate.createAccount")}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (state === "sent") {
    return (
      <div
        data-slot="enquiry-card"
        data-state="sent"
        role="status"
        className={cn(frame, "flex flex-col items-start gap-3")}
      >
        <IconDisc tone="success">
          <Icon icon={CircleCheck} size="lg" />
        </IconDisc>
        <Heading className="text-h3 text-primary">{translate("sent.title")}</Heading>
        <p className="text-small text-muted">{translate("sent.body")}</p>
        <Button asChild variant="primary" className="w-full">
          <Link href={enquiriesHref} className="text-on-primary no-underline hover:text-on-primary">
            {translate("sent.viewEnquiries")}
          </Link>
        </Button>
      </div>
    );
  }

  const optional = translate("optional");
  return (
    <div data-slot="enquiry-card" data-state="form" data-variant={variant} className={frame}>
      {sheet ? (
        <p className="mb-4 text-small text-muted">{translate("form.leadIn")}</p>
      ) : (
        <>
          <Heading className="text-h3 text-primary">{translate("form.title")}</Heading>
          <p className="mt-2 mb-4 text-small text-muted">{translate("form.leadIn")}</p>
        </>
      )}
      <form ref={form} noValidate onSubmit={submit} className="flex flex-col gap-4">
        {failed ? (
          <Alert tone="danger" title={translate("failed.title")}>
            {translate("failed.body")}
          </Alert>
        ) : null}
        <FormField label={translate("form.name")} required {...errorProp(errors, "name")}>
          <Input
            name="name"
            autoComplete="name"
            value={typed.name}
            onChange={(event) => change("name", event.target.value)}
          />
        </FormField>
        <FormField label={translate("form.phone")} required {...errorProp(errors, "phone")}>
          <Input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={typed.phone}
            onChange={(event) => change("phone", event.target.value)}
          />
        </FormField>
        {sheet ? null : (
          <FormField
            label={translate("form.email")}
            optionalLabel={optional}
            {...errorProp(errors, "email")}
          >
            <Input
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder={translate("form.emailPlaceholder")}
              value={typed.email}
              onChange={(event) => change("email", event.target.value)}
            />
          </FormField>
        )}
        <FormField
          label={translate("form.message")}
          optionalLabel={optional}
          {...errorProp(errors, "message")}
        >
          <Textarea
            name="message"
            maxLength={MESSAGE_LIMIT}
            placeholder={translate(
              sheet ? "form.messagePlaceholderShort" : "form.messagePlaceholder",
            )}
            value={typed.message}
            onChange={(event) => change("message", event.target.value)}
            className={sheet ? "min-h-24" : undefined}
            {...(sheet
              ? {}
              : {
                  counter: translate("form.counter", {
                    count: typed.message.length,
                    max: MESSAGE_LIMIT,
                  }),
                })}
          />
        </FormField>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          loading={submitting}
          iconStart={<Icon icon={Send} />}
        >
          {translate("form.send")}
        </Button>
      </form>
    </div>
  );
}

/** The card while the visitor's sign-in is being checked: the form's box, so the page does not jump. */
function EnquiryCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      data-slot="enquiry-card-skeleton"
      aria-hidden="true"
      className={cn("rounded-xl border border-line bg-surface p-6 shadow-card", className)}
    >
      <Skeleton shape="title" className="h-6 w-1/2" />
      <Skeleton shape="text" className="mt-3 w-4/5" />
      <div className="mt-4 flex flex-col gap-4">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export { EnquiryCard, EnquiryCardSkeleton };
export type { EnquiryCardProps, EnquiryErrors, EnquiryField, EnquiryValues };
