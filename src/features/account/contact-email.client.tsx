"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { ContactEmailCard } from "@/components/domain/contact-email-card";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";

/** A quick shape check so an obvious slip needs no round trip; the server checks the address again. */
const LOOKS_LIKE_AN_EMAIL = /^\S+@\S+\.\S+$/;

type SaveContactEmail = (input: { email: string }) => Promise<ActionResult<{ email: string }>>;

type ContactEmailProps = {
  /** The address the account holds for enquiries, or null when none (ADR-186). Private: only the person's own. */
  email: string | null;
  /** The server action that saves it (`saveContactEmail`): the page hands it over, as the email prompt's are. */
  save: SaveContactEmail;
};

/**
 * The dashboard card for the email enquiries about the owner's homes are mailed to (ADR-186). It shows for an owner
 * who has homes: the prompt when there is no address, the saved address with Change when there is one. The address
 * is not confirmed: nothing is sent to it to check, which the hint says. The save is the action's; its checks (the
 * sign-in, the verified phone, the hourly limit, the address) run on the server.
 */
export function ContactEmail({ email: initial, save }: ContactEmailProps) {
  const translateAll = useTranslations() as unknown as Translator;
  const words = useTranslations("account.dashboard.contactEmail");
  const [email, setEmail] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  const [busy, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFailure(undefined);
    const typed = value.trim();
    if (typed === "" || !LOOKS_LIKE_AN_EMAIL.test(typed)) {
      setError(
        translateAll(typed === "" ? "validation.contactEmailRequired" : "validation.emailInvalid"),
      );
      return;
    }
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await save({ email: value });
        if (result.ok) {
          setEmail(result.data.email);
          setEditing(false);
          setValue("");
          notify.success(words("savedToast"));
          return;
        }
        const problem = result.fieldErrors?.["email"]?.[0];
        if (problem) setError(fieldErrorText(translateAll, problem));
        else setFailure(failureText(translateAll, result));
      } catch {
        setFailure(words("failed"));
      }
    });
  }

  return (
    <ContactEmailCard
      className="mb-6"
      email={email}
      editing={editing}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        if (error) setError(undefined);
      }}
      error={error}
      failure={failure}
      busy={busy}
      onSubmit={submit}
      onChange={() => {
        setValue(email ?? "");
        setEditing(true);
      }}
      onCancel={() => {
        setEditing(false);
        setError(undefined);
        setFailure(undefined);
      }}
    />
  );
}
