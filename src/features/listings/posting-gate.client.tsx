"use client";

import { Mail, MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { GateCard } from "@/components/domain/gate-card";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { failureText, type Translator } from "@/i18n/failure-text";
import type { ActionResult } from "@/types/action";

type EmailLinkAction = (input: {
  email: string;
}) => Promise<ActionResult<{ email: string; resendAfter: number }>>;

type PostingGateProps = {
  /** An address a link was already sent to and that is not confirmed yet, or null when there is none. */
  pendingEmail: string | null;
  /** `addEmail`, as the page hands it over (a server action cannot be imported here). */
  send: EmailLinkAction;
  /** `resendEmailLink`. */
  resend: EmailLinkAction;
  /** Where "Not now" leads. */
  browseHref: string;
};

/** A quick shape check so an obvious slip needs no round trip; the server checks the address again. */
const LOOKS_LIKE_AN_EMAIL = /^\S+@\S+\.\S+$/;

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * The posting gate (addendum ADD-03, S6-T02): what a signed-in person without a verified email sees instead of
 * the wizard. It asks for the address, has the link sent (the S3-T09 actions, which check the sign-in, the
 * verified phone and the hourly limit on the server), then shows "Check your email" with a resend that waits
 * out the cooldown. The page asks the server again whenever the person comes back to the tab, so it turns into
 * the wizard by itself once the address is confirmed. Nothing typed in the wizard is lost: it is saved on the
 * server, and the person returns to the same step.
 */
export function PostingGate({ pendingEmail, send, resend, browseHref }: PostingGateProps) {
  const words = useTranslations("postProperty.gate");
  const email = useTranslations("auth.email");
  const translateAll = useTranslations() as unknown as Translator;
  const router = useRouter();
  const [value, setValue] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(pendingEmail);
  const [problem, setProblem] = useState<null | "invalid" | "taken">(null);
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

  // The link is opened in another tab or on another device; coming back here asks the server again.
  useEffect(() => {
    if (sentTo === null) return;
    const ask = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    window.addEventListener("focus", ask);
    document.addEventListener("visibilitychange", ask);
    return () => {
      window.removeEventListener("focus", ask);
      document.removeEventListener("visibilitychange", ask);
    };
  }, [sentTo, router]);

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

  const waitSeconds = Math.max(0, Math.ceil((cooldownEnd - now) / 1000));

  if (sentTo !== null) {
    return (
      <GateCard
        status
        tone="success"
        icon={MailCheck}
        title={email("sentTitle")}
        description={words("sentLead", { email: sentTo })}
        note={words("sentNote")}
      >
        <p className="text-small text-muted">{words("sentInfo")}</p>
        {resent ? (
          <Alert tone="success" title={email("resentTitle")}>
            {email("resentBody")}
          </Alert>
        ) : null}
        {failure ? <Alert tone="danger">{failure}</Alert> : null}
        <p className="text-small text-muted">{email("spam")}</p>
        <div className="flex flex-wrap items-center gap-3">
          {waitSeconds > 0 ? (
            <span className="text-small text-muted">
              {email("resendIn", { time: clock(waitSeconds) })}
            </span>
          ) : (
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              loading={busy}
              onClick={sendAgain}
            >
              {email("resend")}
            </Button>
          )}
        </div>
      </GateCard>
    );
  }

  const problemText =
    problem === "taken"
      ? translateAll("validation.emailTaken")
      : problem === "invalid"
        ? translateAll("validation.emailInvalid")
        : undefined;
  return (
    <GateCard
      icon={Mail}
      title={words("title")}
      description={words("lead")}
      note={words("note")}
      footer={<Link href={browseHref}>{words("notNow")}</Link>}
    >
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField
          label={email("label")}
          {...(problemText ? { error: problemText } : {})}
          {...(problem === "taken" ? { hint: email("takenNote") } : {})}
        >
          <Input
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            disabled={busy}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              if (problem) setProblem(null);
            }}
          />
        </FormField>
        {failure ? <Alert tone="danger">{failure}</Alert> : null}
        <Button type="submit" variant="accent" size="lg" className="w-full" loading={busy}>
          {busy ? email("sending") : email("send")}
        </Button>
      </form>
    </GateCard>
  );
}
