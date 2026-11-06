"use client";

import { useTranslations } from "next-intl";
import {
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  useTransition,
  type FormEvent,
} from "react";
import { Alert } from "@/components/patterns/alert";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { failureText, type Translator } from "@/i18n/failure-text";
import type { ActionResult } from "@/types/action";
import {
  readDismissed,
  serverDismissed,
  subscribeDismissed,
  writeDismissed,
} from "./email-prompt-dismissed";

/** A quick shape check so an obvious slip needs no round trip; the server checks the address again. */
const LOOKS_LIKE_AN_EMAIL = /^\S+@\S+\.\S+$/;

type EmailProblem = "invalid" | "taken";

type EmailLinkAction = (input: { email: string }) => Promise<
  ActionResult<{
    email: string;
    resendAfter: number;
  }>
>;

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export type EmailPromptViewProps = {
  /** "prompt": no address yet, a card with a field. "pending": a link was sent, a reminder. */
  mode: "prompt" | "pending";
  /** What is typed in the field (prompt). */
  value: string;
  onValueChange: (value: string) => void;
  /** The address the link went to (pending). */
  sentTo: string;
  problem: EmailProblem | null;
  /** A failure that is not about the field, already in words. */
  failure: string | null;
  /** A request is on its way. */
  busy: boolean;
  /** Seconds before the link can be asked for again; 0 when it can be asked for now. */
  waitSeconds: number;
  /** A fresh link has just been sent again (read out politely). */
  resent: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onLater: () => void;
  onResend: () => void;
};

/**
 * The email prompt and its reminder (ADD-03), drawn from what it is given so the Design Lab can show
 * every state. The prompt is a card with a field, "Send link" and "Later"; the reminder says a link was
 * sent and offers to send it again. Neither blocks browsing, saving or enquiring.
 */
export function EmailPromptView(props: EmailPromptViewProps) {
  const translate = useTranslations("account.dashboard.email");
  const translateEmail = useTranslations("auth.email");
  const translateAll = useTranslations() as unknown as Translator;
  const titleId = useId();
  const inputId = useId();
  const errorId = useId();

  if (props.mode === "pending") {
    return (
      <div data-slot="email-prompt" data-mode="pending" className="mb-6">
        <Alert
          tone="warning"
          title={translate("pendingTitle")}
          action={
            props.waitSeconds > 0 ? (
              <Text as="span" variant="caption" tone="muted">
                {translateEmail("resendIn", { time: clock(props.waitSeconds) })}
              </Text>
            ) : (
              <Button variant="secondary" size="sm" disabled={props.busy} onClick={props.onResend}>
                {translateEmail("resend")}
              </Button>
            )
          }
        >
          {translate("pendingBody", { email: props.sentTo })}
        </Alert>
        {props.failure ? (
          <Alert tone="danger" className="mt-3">
            {props.failure}
          </Alert>
        ) : null}
        <VisuallyHidden aria-live="polite">
          {props.resent ? translateEmail("resentTitle") : ""}
        </VisuallyHidden>
      </div>
    );
  }

  const error =
    props.problem === "taken"
      ? translateAll("validation.emailTaken")
      : props.problem === "invalid"
        ? translateAll("validation.emailInvalid")
        : undefined;
  return (
    <section
      data-slot="email-prompt"
      data-mode="prompt"
      aria-labelledby={titleId}
      className="mb-6 flex flex-col gap-4 rounded-xl border border-line-strong bg-surface p-5 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="lg:max-w-md">
        <Heading as="h2" size="3" id={titleId}>
          {translate("promptTitle")}
        </Heading>
        <Text tone="muted" className="mt-1">
          {translate("promptBody")}
        </Text>
      </div>
      <form
        noValidate
        onSubmit={props.onSubmit}
        className="flex flex-col gap-3 md:flex-row md:items-start"
      >
        <div className="md:w-72">
          <Label htmlFor={inputId} className="sr-only">
            {translateEmail("label")}
          </Label>
          <Input
            id={inputId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={translate("placeholder")}
            invalid={error !== undefined}
            aria-describedby={error ? errorId : undefined}
            disabled={props.busy}
            value={props.value}
            onChange={(event) => props.onValueChange(event.target.value)}
          />
          {error ? (
            <Text id={errorId} variant="caption" className="mt-1 text-danger">
              {error}
            </Text>
          ) : null}
          {props.problem === "taken" ? (
            <Text variant="caption" tone="muted" className="mt-1">
              {translateEmail("takenNote")}
            </Text>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="accent" loading={props.busy} disabled={props.busy}>
            {props.busy ? translate("sending") : translate("send")}
          </Button>
          <Button type="button" variant="ghost" onClick={props.onLater}>
            {translate("later")}
          </Button>
        </div>
        {props.failure ? <Alert tone="danger">{props.failure}</Alert> : null}
      </form>
    </section>
  );
}

type EmailPromptProps = {
  /** What the server found: no address (the prompt) or a link already sent (the reminder). */
  state: { kind: "none" } | { kind: "pending"; email: string };
  /** The server action that attaches an address and has the link sent (`addEmail`). */
  send: EmailLinkAction;
  /** The server action that sends the link again (`resendEmailLink`). */
  resend: EmailLinkAction;
};

/**
 * The email prompt on the dashboard (ADD-03). A visitor with no address sees the card once; "Later"
 * hides it in this browser. Once a link is sent, or when the server already knows one was, the
 * reminder stays until the address is confirmed. Sending and resending are the S3-T09 actions, which
 * check the sign-in, the verified phone and the hourly limit on the server.
 */
export function EmailPrompt({ state, send, resend }: EmailPromptProps) {
  const translateAll = useTranslations() as unknown as Translator;
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, serverDismissed);
  const [value, setValue] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(
    state.kind === "pending" ? state.email : null,
  );
  const [problem, setProblem] = useState<EmailProblem | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [now, setNow] = useState(0);
  const [busy, startTransition] = useTransition();

  useEffect(() => {
    if (cooldownEnd === 0) return;
    const timer = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= cooldownEnd) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownEnd]);

  function startCooldown(seconds: number) {
    const at = Date.now();
    setCooldownEnd(at + seconds * 1000);
    setNow(at);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!LOOKS_LIKE_AN_EMAIL.test(value.trim())) {
      setProblem("invalid");
      return;
    }
    setProblem(null);
    setFailure(null);
    startTransition(async () => {
      const result = await send({ email: value });
      if (result.ok) {
        setSentTo(result.data.email);
        setResent(false);
        startCooldown(result.data.resendAfter);
        return;
      }
      const fieldError = result.fieldErrors?.["email"]?.[0];
      if (fieldError) setProblem(fieldError.key === "validation.emailTaken" ? "taken" : "invalid");
      else setFailure(failureText(translateAll, result));
    });
  }

  function sendAgain() {
    if (!sentTo || busy) return;
    setFailure(null);
    setResent(false);
    startTransition(async () => {
      const result = await resend({ email: sentTo });
      if (result.ok) {
        setResent(true);
        startCooldown(result.data.resendAfter);
        return;
      }
      if (result.code === "RATE_LIMITED" && result.retryAfter) startCooldown(result.retryAfter);
      setFailure(failureText(translateAll, result));
    });
  }

  if (sentTo === null && dismissed) return null;
  return (
    <EmailPromptView
      mode={sentTo === null ? "prompt" : "pending"}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        if (problem) setProblem(null);
      }}
      sentTo={sentTo ?? ""}
      problem={problem}
      failure={failure}
      busy={busy}
      waitSeconds={Math.max(0, Math.ceil((cooldownEnd - now) / 1000))}
      resent={resent}
      onSubmit={submit}
      onLater={writeDismissed}
      onResend={sendAgain}
    />
  );
}
