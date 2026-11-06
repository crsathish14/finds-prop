"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type {
  EnquiryCardProps,
  EnquiryErrors,
  EnquiryValues,
} from "@/components/domain/enquiry-card";
import { fieldErrorText, type Translator } from "@/i18n/failure-text";
import { dropDraft, saveDraft } from "@/lib/form-draft";
import { isSessionEnded, sessionEndedHref } from "@/lib/session-ended";
import { useRestoredDraft, useRestoredNotice } from "@/lib/use-restored-draft";
import type { ActionResult } from "@/types/action";

/** The enquiry action, as the page hands it over (the server action `sendEnquiry`). */
export type SendEnquiryAction = (input: {
  shortId: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  idempotencyKey: string;
}) => Promise<ActionResult<{ received: true }>>;

/** What the page gives the form so it can send: the home, the action, what to start with and where "My enquiries" is. */
export type EnquiryConnection = {
  shortId: string;
  send: SendEnquiryAction;
  /** The account's own name, phone and verified email, to start with; the visitor can change them. */
  prefill: Partial<EnquiryValues>;
  enquiriesHref: string;
};

const FIELDS = ["name", "phone", "email", "message"] as const;
/** The answers kept while the visitor signs in again. The phone is left out: the new session's own is used. */
const DRAFT_FIELDS = ["name", "email", "message"] as const;
const DRAFT_NAME = "enquiry";
const isField = (name: unknown): name is (typeof FIELDS)[number] =>
  FIELDS.some((field) => field === name);

type FormProps = Pick<
  EnquiryCardProps,
  | "state"
  | "values"
  | "errors"
  | "failed"
  | "rateLimited"
  | "sessionEnded"
  | "ownHome"
  | "submitting"
  | "enquiriesHref"
  | "onSubmit"
>;

/**
 * Connects the enquiry card (or the phone's sheet) to the action `sendEnquiry` (S5-T03). It makes one
 * idempotency key when the form opens, so a double click or a retry stores one enquiry (R-BE-05), and
 * draws what comes back: the confirmation, "already sent" (an enquiry about this home within 24 hours),
 * the field messages, "please wait" (too many today), "this is your own home", or "try again" for
 * anything else, with what was typed kept. When the visitor's session has ended it says so with a link to
 * sign in again, which keeps the name, email and message for the way back (S5-T07); the form starts again
 * with them (give it `formKey` as its key). The server checks everything and decides; nothing here
 * says who is sending. Without a connection (the Design Lab, a test) the form is drawn and sends nothing.
 */
export function useEnquiryForm(connection: EnquiryConnection | undefined): {
  card: FormProps;
  /** Changes when kept answers are restored, so the form can be started again with them. */
  formKey: string;
} {
  // The same cast the helper's own test uses: next-intl's strict translator type is wider than Translator.
  const translate = useTranslations() as unknown as Translator;
  const [key] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<"form" | "sent" | "already">("form");
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [rateLimited, setRateLimited] = useState(false);
  const [ownHome, setOwnHome] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sessionEnded, setSessionEnded] = useState<{
    href: string;
    values: Record<string, string>;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const words = useTranslations("domain.sessionEnded");
  const draft = useRestoredDraft(DRAFT_NAME);
  useRestoredNotice(DRAFT_NAME, draft, words("restored"));

  if (!connection) return { card: { state: "form" }, formKey: "fresh" };

  const kept: Partial<EnquiryValues> = {};
  for (const field of DRAFT_FIELDS) {
    const value = draft?.[field];
    if (typeof value === "string") kept[field] = value;
  }

  function send(values: EnquiryValues) {
    if (!connection) return;
    setErrors({});
    setRateLimited(false);
    setOwnHome(false);
    setFailed(false);
    setSessionEnded(null);
    startTransition(async () => {
      try {
        const result = await connection.send({
          shortId: connection.shortId,
          name: values.name,
          phone: values.phone,
          email: values.email,
          message: values.message,
          idempotencyKey: key,
        });
        if (result.ok) {
          dropDraft(DRAFT_NAME, window.location.pathname);
          setOutcome("sent");
          return;
        }
        if (isSessionEnded(result)) {
          setSessionEnded({
            href: sessionEndedHref(window.location.pathname),
            values: { name: values.name, email: values.email, message: values.message },
          });
          return;
        }
        if (result.code === "CONFLICT") {
          setOutcome("already");
          return;
        }
        if (result.code === "RATE_LIMITED") {
          setRateLimited(true);
          return;
        }
        if (result.code === "FORBIDDEN") {
          setOwnHome(true);
          return;
        }
        const found: EnquiryErrors = {};
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

  return {
    card: {
      state: outcome,
      values: { ...connection.prefill, ...kept },
      errors,
      failed,
      rateLimited,
      ...(sessionEnded
        ? {
            sessionEnded: {
              href: sessionEnded.href,
              onSignIn: () => saveDraft(DRAFT_NAME, window.location.pathname, sessionEnded.values),
            },
          }
        : {}),
      ownHome,
      submitting: pending,
      enquiriesHref: connection.enquiriesHref,
      onSubmit: send,
    },
    formKey: draft ? "restored" : "fresh",
  };
}
