"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { fieldErrorText, type Translator } from "@/i18n/failure-text";
import { submitProjectLead } from "./actions";
import { submitProjectLeadSchema } from "./lead-schemas";
import {
  ProjectLeadCard,
  type LeadErrors,
  type LeadKind,
  type LeadValues,
} from "./project-lead-card.client";

type ProjectLeadPanelProps = {
  slug: string;
  /** The account's phone as it is shown (masked). The number sent is read from the account on the server. */
  phone: string;
  visitDateMin: string;
  visitDateMax: string;
};

const FIELDS = ["name", "email", "visitDate", "message"] as const;
type Field = (typeof FIELDS)[number];

const isField = (name: unknown): name is Field => FIELDS.some((field) => field === name);

/**
 * The enquiry card of a signed-in visitor with a verified phone, connected to the action
 * `submitProjectLead` (S4-T09 step D1b). It makes one idempotency key when the page opens, so a double
 * click or a retry stores one lead; checks what it can before the round trip (the server checks again
 * and decides); and draws what comes back: the thank-you note, the field messages, "please wait" when
 * the visitor has sent five in the hour, or "try again" for anything else. A form that has not been
 * accepted stays as typed.
 */
export function ProjectLeadPanel({
  slug,
  phone,
  visitDateMin,
  visitDateMax,
}: ProjectLeadPanelProps) {
  // The same cast the helper's own test uses: next-intl's strict translator type is wider than Translator.
  const translate = useTranslations() as unknown as Translator;
  const [key] = useState(() => crypto.randomUUID());
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [rateLimited, setRateLimited] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function send(kind: LeadKind, values: LeadValues) {
    setErrors({});
    setRateLimited(false);
    setFailed(false);
    const input = {
      slug,
      kind,
      name: values.name,
      email: values.email,
      message: values.message,
      ...(kind === "site_visit" ? { visitDate: values.visitDate } : {}),
      idempotencyKey: key,
    };

    const checked = submitProjectLeadSchema.safeParse(input);
    if (!checked.success) {
      const found: LeadErrors = {};
      for (const issue of checked.error.issues) {
        const field = issue.path[0];
        if (isField(field) && !found[field]) {
          found[field] = fieldErrorText(translate, { key: issue.message });
        }
      }
      if (Object.keys(found).length > 0) setErrors(found);
      else setFailed(true);
      return;
    }

    startTransition(async () => {
      try {
        const result = await submitProjectLead(input);
        if (result.ok) {
          setSent(true);
          return;
        }
        if (result.code === "RATE_LIMITED") {
          setRateLimited(true);
          return;
        }
        const found: LeadErrors = {};
        for (const [name, list] of Object.entries(result.fieldErrors ?? {})) {
          const first = list?.[0];
          if (isField(name) && first) found[name] = fieldErrorText(translate, first);
        }
        if (Object.keys(found).length > 0) setErrors(found);
        else setFailed(true);
      } catch {
        // The request itself did not get through (offline, server down): say so, keep the form as typed.
        setFailed(true);
      }
    });
  }

  return (
    <ProjectLeadCard
      state={sent ? "sent" : "form"}
      phone={phone}
      visitDateMin={visitDateMin}
      visitDateMax={visitDateMax}
      errors={errors}
      rateLimited={rateLimited}
      failed={failed}
      submitting={pending}
      onSubmit={send}
    />
  );
}
