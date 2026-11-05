"use client";

import { CalendarDays, CircleCheck, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/cn";

export type LeadKind = "enquiry" | "site_visit";
export type LeadValues = {
  name: string;
  phone: string;
  email: string;
  visitDate: string;
  message: string;
};
type LeadField = keyof LeadValues;
export type LeadErrors = Partial<Record<LeadField, string>>;

type ProjectLeadCardProps = {
  /** "form" the card, or "sent" the confirmation that replaces it. */
  state: "form" | "sent";
  /** Which request is chosen first (Enquire by default). */
  defaultKind?: LeadKind;
  values?: Partial<LeadValues>;
  /** Already-translated messages; a field with one is marked invalid. */
  errors?: LeadErrors;
  /** The visitor sent too many requests in the hour: the "please wait" alert above the form. */
  rateLimited?: boolean;
  submitting?: boolean;
  /** Send is switched off (the form can be filled, nothing can be sent yet) and a line says why. */
  sendDisabled?: boolean;
  sendNotice?: string;
  onSubmit?: (kind: LeadKind, values: LeadValues) => void;
  className?: string;
};

const MESSAGE_LIMIT = 1000;
const FIELD_ORDER: readonly LeadField[] = ["name", "phone", "email", "visitDate", "message"];

/** The error prop of a field, only when it has an error (the field takes no undefined). */
function errorProp(errors: LeadErrors | undefined, field: LeadField): { error?: string } {
  const message = errors?.[field];
  return message ? { error: message } : {};
}

/**
 * The box beside a project's details where a visitor asks the developer something or asks for a site
 * visit (UX: "Interested in this project?"): Enquire or Site visit, name and phone (required), email
 * (optional), the preferred date (a site visit only, required) and a message (optional). Anyone can use
 * it, signed in or not. It is the screen only: it holds what the visitor has typed and hands the values
 * over; it sends nothing (the lead action is a later task), so the page switches Send off with a line
 * that says so. Errors, the "please wait" alert and the confirmation are drawn from props. The anchor
 * `#enquiry` is this card, so the phone bar can lead to it.
 */
export function ProjectLeadCard({
  state,
  defaultKind = "enquiry",
  values,
  errors,
  rateLimited = false,
  submitting = false,
  sendDisabled = false,
  sendNotice,
  onSubmit,
  className,
}: ProjectLeadCardProps) {
  const translate = useTranslations("projects.page.lead");
  const shared = useTranslations("domain.enquiry");
  const [kind, setKind] = useState<LeadKind>(defaultKind);
  const [typed, setTyped] = useState<LeadValues>({
    name: values?.name ?? "",
    phone: values?.phone ?? "",
    email: values?.email ?? "",
    visitDate: values?.visitDate ?? "",
    message: values?.message ?? "",
  });
  const form = useRef<HTMLFormElement>(null);
  const shown = useRef(false);
  const noticeId = useId();

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
        <FormField label={translate("name")} required {...errorProp(errors, "name")}>
          <Input
            name="name"
            autoComplete="name"
            value={typed.name}
            onChange={(event) => change("name", event.target.value)}
          />
        </FormField>
        <FormField label={translate("phone")} required {...errorProp(errors, "phone")}>
          <Input
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={typed.phone}
            onChange={(event) => change("phone", event.target.value)}
          />
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
          disabled={sendDisabled}
          {...(sendNotice ? { "aria-describedby": noticeId } : {})}
          iconStart={<Icon icon={siteVisit ? CalendarDays : Send} />}
        >
          {siteVisit ? translate("requestVisit") : translate("send")}
        </Button>
        {sendNotice ? (
          <p id={noticeId} className="-mt-1 text-center text-caption text-muted">
            {sendNotice}
          </p>
        ) : null}
      </form>
    </div>
  );
}
