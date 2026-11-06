"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { fieldErrorText, type Translator } from "@/i18n/failure-text";
import { dropDraft, saveDraft } from "@/lib/form-draft";
import { isSessionEnded, sessionEndedHref } from "@/lib/session-ended";
import { useRestoredDraft, useRestoredNotice } from "@/lib/use-restored-draft";
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
  /** The developer the request goes to, named in the consent line. */
  developerName: string;
  /** The account's phone as it is shown (masked). The number sent is read from the account on the server. */
  phone: string;
  visitDateMin: string;
  visitDateMax: string;
};

const FIELDS = ["name", "email", "visitDate", "message"] as const;
const DRAFT_NAME = "project-lead";
type Field = (typeof FIELDS)[number];

const isField = (name: unknown): name is Field => FIELDS.some((field) => field === name);

/**
 * The enquiry card of a signed-in visitor with a verified phone, connected to the action
 * `submitProjectLead` (S4-T09 step D1b). It makes one idempotency key when the page opens, so a double
 * click or a retry stores one lead; checks what it can before the round trip (the server checks again
 * and decides); and draws what comes back: the thank-you note, the field messages, "please wait" when
 * the visitor has sent five in the hour, or "try again" for anything else. A form that has not been
 * accepted stays as typed. When the session has ended it says so with a link to sign in again, which keeps
 * the request kind and what was typed for the way back (S5-T07); the card starts again with them.
 */
export function ProjectLeadPanel({
  slug,
  developerName,
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
  const [sessionEnded, setSessionEnded] = useState<{
    href: string;
    answers: Record<string, string>;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const words = useTranslations("domain.sessionEnded");
  const draft = useRestoredDraft(DRAFT_NAME);
  useRestoredNotice(DRAFT_NAME, draft, words("restored"));

  const kept: Partial<LeadValues> = {};
  for (const field of FIELDS) {
    const value = draft?.[field];
    if (typeof value === "string") kept[field] = value;
  }
  const keptKind: LeadKind = draft?.["kind"] === "site_visit" ? "site_visit" : "enquiry";

  function send(kind: LeadKind, values: LeadValues) {
    setErrors({});
    setRateLimited(false);
    setFailed(false);
    setSessionEnded(null);
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
          dropDraft(DRAFT_NAME, window.location.pathname);
          setSent(true);
          return;
        }
        if (isSessionEnded(result)) {
          setSessionEnded({
            href: sessionEndedHref(window.location.pathname, "#enquiry"),
            answers: {
              kind,
              name: values.name,
              email: values.email,
              visitDate: values.visitDate,
              message: values.message,
            },
          });
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
      key={draft ? "restored" : "fresh"}
      state={sent ? "sent" : "form"}
      defaultKind={keptKind}
      values={kept}
      phone={phone}
      developerName={developerName}
      visitDateMin={visitDateMin}
      visitDateMax={visitDateMax}
      errors={errors}
      rateLimited={rateLimited}
      failed={failed}
      {...(sessionEnded
        ? {
            sessionEnded: {
              href: sessionEnded.href,
              onSignIn: () => saveDraft(DRAFT_NAME, window.location.pathname, sessionEnded.answers),
            },
          }
        : {})}
      submitting={pending}
      onSubmit={send}
    />
  );
}
