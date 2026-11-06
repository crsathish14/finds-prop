"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type {
  EnquiryCardProps,
  EnquiryErrors,
  EnquiryValues,
} from "@/components/domain/enquiry-card";
import { fieldErrorText, type Translator } from "@/i18n/failure-text";
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
const isField = (name: unknown): name is (typeof FIELDS)[number] =>
  FIELDS.some((field) => field === name);

type FormProps = Pick<
  EnquiryCardProps,
  | "state"
  | "values"
  | "errors"
  | "failed"
  | "rateLimited"
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
 * anything else, with what was typed kept. The server checks everything and decides; nothing here
 * says who is sending. Without a connection (the Design Lab, a test) the form is drawn and sends nothing.
 */
export function useEnquiryForm(connection: EnquiryConnection | undefined): FormProps {
  // The same cast the helper's own test uses: next-intl's strict translator type is wider than Translator.
  const translate = useTranslations() as unknown as Translator;
  const [key] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<"form" | "sent" | "already">("form");
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [rateLimited, setRateLimited] = useState(false);
  const [ownHome, setOwnHome] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!connection) return { state: "form" };

  function send(values: EnquiryValues) {
    if (!connection) return;
    setErrors({});
    setRateLimited(false);
    setOwnHome(false);
    setFailed(false);
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
          setOutcome("sent");
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
        if (result.code === "FORBIDDEN" && result.reason !== "PHONE_NOT_VERIFIED") {
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
    state: outcome,
    values: connection.prefill,
    errors,
    failed,
    rateLimited,
    ownHome,
    submitting: pending,
    enquiriesHref: connection.enquiriesHref,
    onSubmit: send,
  };
}
