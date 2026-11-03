"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { failureText, type Translator } from "@/i18n/failure-text";
import { addEmail, resendEmailLink } from "./actions";
import { goTo } from "./navigate";
import { marker, withLinks } from "./with-links";

/** A quick shape check so an obvious slip needs no round trip; the server checks the address again. */
const LOOKS_LIKE_AN_EMAIL = /^\S+@\S+\.\S+$/;

type EmailProblem = "invalid" | "taken";

type EmailStepProps = {
  /** Where "Not now" goes: the page the visitor was headed for, already checked (BR-06). */
  redirectTo: string;
};

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * The email step (ADD-03): add an address, then wait for its link. The link is sent by Supabase and
 * finished at /auth/confirm; nothing here marks the email verified. "Taken" never says why an address
 * cannot be used, to protect other people's accounts. A visitor may skip: only posting a property
 * needs a verified email. Words come from en.json.
 */
export function EmailStep({ redirectTo }: EmailStepProps) {
  const translate = useTranslations("auth.email");
  // The same cast the helper's own test uses: next-intl's strict translator type is wider than Translator.
  const translateAll = useTranslations() as unknown as Translator;
  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [problem, setProblem] = useState<EmailProblem | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [now, setNow] = useState(0);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = Math.max(0, Math.ceil((cooldownEnd - now) / 1000));
  const spoken =
    remaining === 30 || remaining === 10
      ? translate("resendSoon", { seconds: remaining })
      : remaining === 0 && cooldownEnd > 0
        ? translate("resendReady")
        : "";

  function startCooldown(seconds: number) {
    const at = Date.now();
    setCooldownEnd(at + seconds * 1000);
    setNow(at);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!LOOKS_LIKE_AN_EMAIL.test(email.trim())) {
      setProblem("invalid");
      return;
    }
    setProblem(null);
    setFailure(null);
    startTransition(async () => {
      const result = await addEmail({ email });
      if (result.ok) {
        setSentTo(result.data.email);
        setResent(false);
        startCooldown(result.data.resendAfter);
        return;
      }
      const fieldError = result.fieldErrors?.email?.[0];
      if (fieldError) setProblem(fieldError.key === "validation.emailTaken" ? "taken" : "invalid");
      else setFailure(failureText(translateAll, result));
    });
  }

  function resend() {
    if (!sentTo || remaining > 0 || pending) return;
    setFailure(null);
    setResent(false);
    startTransition(async () => {
      const result = await resendEmailLink({ email: sentTo });
      if (result.ok) {
        setResent(true);
        startCooldown(result.data.resendAfter);
        return;
      }
      const retryAfter = result.code === "RATE_LIMITED" ? result.retryAfter : undefined;
      if (retryAfter) startCooldown(retryAfter);
      setFailure(failureText(translateAll, result));
    });
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4">
        <Heading as="h1" size="2">
          {translate("sentTitle")}
        </Heading>
        <Text variant="lead">
          {withLinks(translate("sentTo", { email: marker("email") }), { email: <b>{sentTo}</b> })}
        </Text>
        {resent ? (
          <Alert tone="success" title={translate("resentTitle")}>
            {translate("resentBody")}
          </Alert>
        ) : null}
        {failure ? <Alert tone="danger">{failure}</Alert> : null}
        <Text variant="caption" tone="muted">
          {translate("spam")}
        </Text>
        <div className="flex flex-wrap items-center gap-x-2 text-small text-muted">
          {remaining > 0 ? (
            <Text as="span" tone="muted">
              {translate("resendIn", { time: clock(remaining) })}
            </Text>
          ) : (
            <Button variant="ghost" size="sm" disabled={pending} onClick={resend}>
              {translate("resend")}
            </Button>
          )}
          <VisuallyHidden aria-live="polite">{spoken}</VisuallyHidden>
        </div>
        <Button variant="ghost" className="self-start px-0" onClick={() => setSentTo(null)}>
          {translate("different")}
        </Button>
      </div>
    );
  }

  const error =
    problem === "taken"
      ? translateAll("validation.emailTaken")
      : problem === "invalid"
        ? translateAll("validation.emailInvalid")
        : undefined;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Heading as="h1" size="2">
          {translate("title")}
        </Heading>
        <Text variant="lead" className="mt-2">
          {translate("lead")}
        </Text>
      </div>

      {failure ? <Alert tone="danger">{failure}</Alert> : null}

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField label={translate("label")} required {...(error ? { error } : {})}>
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            invalid={problem !== null}
            disabled={pending}
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (problem) setProblem(null);
            }}
          />
        </FormField>
        {problem === "taken" ? (
          <Text variant="caption" tone="muted">
            {translate("takenNote")}
          </Text>
        ) : null}
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          loading={pending}
          disabled={pending}
        >
          {pending ? translate("sending") : translate("send")}
        </Button>
      </form>

      <div className="text-center">
        <Button variant="ghost" onClick={() => goTo(redirectTo)} disabled={pending}>
          {translate("skip")}
        </Button>
      </div>
    </div>
  );
}
