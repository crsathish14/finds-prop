"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { DynamicForm, type DynamicFormValues } from "@/components/domain/dynamic-form";
import { fieldErrorText, type Translator } from "@/i18n/failure-text";
import type { ActionResult } from "@/types/action";
import type { FormDefinition } from "./schemas";

/** The form action `submitForm`, as the page hands it over (a server action cannot be imported here). */
export type SubmitFormAction = (input: {
  formSlug: string;
  values: Record<string, string | number | boolean | string[]>;
  source?: string;
  projectSlug?: string;
  idempotencyKey: string;
}) => Promise<ActionResult<{ received: true }>>;

type ConnectedFormProps = {
  form: FormDefinition;
  send: SubmitFormAction;
  /** The page the form is on, kept with the submission. */
  source: string;
  /** For a form shown on every project page: the project page it is on. */
  projectSlug?: string;
  /** The consent line under the button. */
  consent?: ReactNode;
  /** What replaces the form once it has been sent. */
  sent: ReactNode;
  className?: string;
};

/**
 * Connects the dynamic form to the action `submitForm` (S5-T05). It makes one idempotency key when the form
 * opens, so a double click or a retry stores one submission (R-BE-05), and draws what comes back: the
 * confirmation, the field messages, "limit reached" (too many sent this hour), or "try again" for anything
 * else, with what was typed kept. The server checks everything and decides; nothing here says who is
 * sending.
 */
export function ConnectedForm({
  form,
  send,
  source,
  projectSlug,
  consent,
  sent,
  className,
}: ConnectedFormProps) {
  // The same cast the helper's own test uses: next-intl's strict translator type is wider than Translator.
  const translate = useTranslations() as unknown as Translator;
  const [key] = useState(() => crypto.randomUUID());
  const [done, setDone] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rateLimited, setRateLimited] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) return <>{sent}</>;

  function submit(values: DynamicFormValues) {
    setErrors({});
    setRateLimited(false);
    setFailed(false);
    startTransition(async () => {
      try {
        const result = await send({
          formSlug: form.slug,
          values,
          source,
          ...(projectSlug ? { projectSlug } : {}),
          idempotencyKey: key,
        });
        if (result.ok) {
          setDone(true);
          return;
        }
        if (result.code === "RATE_LIMITED") {
          setRateLimited(true);
          return;
        }
        const found: Record<string, string> = {};
        for (const [name, list] of Object.entries(result.fieldErrors ?? {})) {
          const first = list?.[0];
          if (first && form.fields.some((field) => field.key === name)) {
            found[name] = fieldErrorText(translate, first);
          }
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
    <DynamicForm
      fields={form.fields}
      buttonText={form.buttonText}
      errors={errors}
      failed={failed}
      rateLimited={rateLimited}
      submitting={pending}
      consent={consent}
      onSubmit={submit}
      {...(className ? { className } : {})}
    />
  );
}
