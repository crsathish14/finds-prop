"use client";

import { CalendarDays, CircleCheck, Lock, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

export type LeadKind = "enquiry" | "site_visit";
export type LeadValues = {
  name: string;
  email: string;
  visitDate: string;
  message: string;
};
type LeadField = keyof LeadValues;
export type LeadErrors = Partial<Record<LeadField, string>>;

type ProjectLeadCardProps = {
  /** "signed_out" the gate, "form" the card, or "sent" the confirmation that replaces it. */
  state: "signed_out" | "form" | "sent";
  /** The gate's two links (sign in, asking to come back to this project; create an account). */
  signInHref?: string;
  createAccountHref?: string;
  /** The account's phone as it is shown (masked): the form cannot change it, the server uses the account's own. */
  phone?: string;
  /** Which request is chosen first (Enquire by default). */
  defaultKind?: LeadKind;
  values?: Partial<LeadValues>;
  /** The first and last day a visit can be asked for (`YYYY-MM-DD`). */
  visitDateMin?: string;
  visitDateMax?: string;
  /** Already-translated messages; a field with one is marked invalid. */
  errors?: LeadErrors;
  /** The visitor sent too many requests in the hour: the "please wait" alert above the form. */
  rateLimited?: boolean;
  /** Sending failed for a reason the visitor cannot fix by editing a field: a "try again" alert above the form. */
  failed?: boolean;
  submitting?: boolean;
  onSubmit?: (kind: LeadKind, values: LeadValues) => void;
  className?: string;
};

const MESSAGE_LIMIT = 1000;
const FIELD_ORDER: readonly LeadField[] = ["name", "email", "visitDate", "message"];

/** The error prop of a field, only when it has an error (the field takes no undefined). */
function errorProp(errors: LeadErrors | undefined, field: LeadField): { error?: string } {
  const message = errors?.[field];
  return message ? { error: message } : {};
}

/**
 * The box beside a project's details where a visitor asks the developer something or asks for a site
 * visit (UX: "Interested in this project?"). Anyone can read the project, but sending needs a phone
 * sign-in (owner decision, 6 Nov 2026), so a visitor who is not signed in sees the gate (sign in, or
 * create an account) and a signed-in one sees the form: Enquire or Site visit, name (required), the
 * account's phone (shown, locked), email (optional), the preferred date (a site visit only, required,
 * from today to a year ahead) and a message (optional). It is the screen only: it holds what the
 * visitor has typed and hands the values over. Errors, the "please wait" and "try again" alerts and the
 * confirmation are drawn from props. The anchor `#enquiry` is this card, so the phone bar can lead to it.
 */
export function ProjectLeadCard({
  state,
  signInHref = "#",
  createAccountHref = "#",
  phone = "",
  defaultKind = "enquiry",
  values,
  visitDateMin,
  visitDateMax,
  errors,
  rateLimited = false,
  failed = false,
  submitting = false,
  onSubmit,
  className,
}: ProjectLeadCardProps) {
  const translate = useTranslations("projects.page.lead");
  const shared = useTranslations("domain.enquiry");
  const [kind, setKind] = useState<LeadKind>(defaultKind);
  const [typed, setTyped] = useState<LeadValues>({
    name: values?.name ?? "",
    email: values?.email ?? "",
    visitDate: values?.visitDate ?? "",
    message: values?.message ?? "",
  });
  const form = useRef<HTMLFormElement>(null);
  const shown = useRef(false);

  // Errors that arrive after the card is shown take the reader to the first field with one. Errors that
  // are there from the start (the Design Lab shows them) do not steal focus.
  useEffect(() => {
    if (!shown.current) {
      shown.current = true;
      return;
    }
    const first = FIELD_ORDER.find((field) => errors?.[field]);
    if (first) form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  }, [errors]);

  function change(field: LeadField, value: string) {
    setTyped((current) => ({ ...current, [field]: value }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    onSubmit?.(kind, typed);
  }

  const frame = "scroll-mt-6 rounded-xl border border-line bg-surface p-6 shadow-card";

  if (state === "signed_out") {
    return (
      <div
        id="enquiry"
        data-slot="project-lead-card"
        data-state="signed_out"
        className={cn(frame, className)}
      >
        <span
          aria-hidden="true"
          className="grid size-12 place-items-center rounded-pill bg-info-tint text-info"
        >
          <Icon icon={Lock} size="lg" />
        </span>
        <Heading as="h2" size="3" className="mt-3">
          {translate("title")}
        </Heading>
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
        id="enquiry"
        data-slot="project-lead-card"
        data-state="sent"
        role="status"
        className={cn(frame, className)}
      >
        <div className="flex flex-col items-start gap-3">
          <span
            aria-hidden="true"
            className="grid size-12 place-items-center rounded-pill bg-success-tint text-success"
          >
            <Icon icon={CircleCheck} size="lg" />
          </span>
          <Heading as="h2" size="3">
            {translate("sent.title")}
          </Heading>
          <p className="text-small text-muted">{translate("sent.body")}</p>
        </div>
      </div>
    );
  }

  const siteVisit = kind === "site_visit";
  const optional = shared("optional");
  return (
    <div
      id="enquiry"
      data-slot="project-lead-card"
      data-state="form"
      data-kind={kind}
      className={cn(frame, className)}
    >
      <Heading as="h2" size="3">
        {translate("title")}
      </Heading>
      <SegmentedControl
        block
        aria-label={translate("kindLabel")}
        value={kind}
        onValueChange={(next) => setKind(next === "site_visit" ? "site_visit" : "enquiry")}
        options={[
          { value: "enquiry", label: translate("enquire") },
          { value: "site_visit", label: translate("siteVisit") },
        ]}
        className="mt-3"
      />
      <form ref={form} noValidate onSubmit={submit} className="mt-4 flex flex-col gap-4">
        {rateLimited ? (
          <Alert tone="warning" title={translate("rateLimit.title")}>
            {translate("rateLimit.body")}
          </Alert>
        ) : null}
        {failed ? <Alert tone="danger">{translate("failed")}</Alert> : null}
        <FormField label={translate("name")} required {...errorProp(errors, "name")}>
          <Input
            name="name"
            autoComplete="name"
            value={typed.name}
            onChange={(event) => change("name", event.target.value)}
          />
        </FormField>
        <FormField label={translate("phone")} hint={translate("phoneHint")}>
          <Input name="phone" type="tel" readOnly value={phone} />
        </FormField>
        <FormField
          label={translate("email")}
          optionalLabel={optional}
          {...errorProp(errors, "email")}
        >
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={shared("form.emailPlaceholder")}
            value={typed.email}
            onChange={(event) => change("email", event.target.value)}
          />
        </FormField>
        {siteVisit ? (
          <FormField label={translate("visitDate")} required {...errorProp(errors, "visitDate")}>
            <Input
              name="visitDate"
              type="date"
              {...(visitDateMin ? { min: visitDateMin } : {})}
              {...(visitDateMax ? { max: visitDateMax } : {})}
              value={typed.visitDate}
              onChange={(event) => change("visitDate", event.target.value)}
            />
          </FormField>
        ) : null}
        <FormField
          label={translate("message")}
          optionalLabel={optional}
          {...errorProp(errors, "message")}
        >
          <Textarea
            name="message"
            maxLength={MESSAGE_LIMIT}
            placeholder={translate("messagePlaceholder")}
            value={typed.message}
            onChange={(event) => change("message", event.target.value)}
            counter={shared("form.counter", { count: typed.message.length, max: MESSAGE_LIMIT })}
          />
        </FormField>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          loading={submitting}
          iconStart={<Icon icon={siteVisit ? CalendarDays : Send} />}
        >
          {siteVisit ? translate("requestVisit") : translate("send")}
        </Button>
      </form>
    </div>
  );
}
