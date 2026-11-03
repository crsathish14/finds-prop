"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState, useTransition } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { OtpInput } from "@/components/patterns/otp-input";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { VisuallyHidden } from "@/components/ui/visually-hidden";
import { maskIndianMobile } from "@/lib/phone";
import { sendPhoneCode, verifyPhoneCode } from "./actions";
import { CODE_LENGTH, CODE_LIFETIME_SECONDS } from "./constants";
import { HumanCheck, type HumanCheckStatus } from "./human-check.client";
import { goTo } from "./navigate";
import { marker, withLinks } from "./with-links";

const CODE_FIELD_ID = "verification-code";
/** How long "Number verified" stays up before the visitor is taken on; Continue goes at once. */
const SUCCESS_PAUSE_MS = 1500;
const FALLBACK_WAIT_SECONDS = 600;

type Problem = "wrong" | "expired" | "unavailable" | { problem: "locked"; minutes: number };
type ResendNotice =
  "resent" | "captchafail" | "unavailable" | { problem: "blocked"; minutes: number };

type CodeEntryProps = {
  /** The number the code was sent to, as +91XXXXXXXXXX. It stays in this component, never in the address. */
  phone: string;
  /** When the code was asked for (milliseconds), set by the handler that sent it. */
  sentAt: number;
  /** Seconds before a new code may be asked for. */
  resendAfter: number;
  siteKey: string | undefined;
  /** Where to go once signed in: an address the page has already checked (BR-06). */
  redirectTo: string;
  onChangeNumber: () => void;
  /** A new account has no name yet: the page asks for it before going on (ADD-04). */
  onNeedsName: () => void;
};

function minutesToWait(retryAfter: number | undefined): number {
  return Math.max(1, Math.ceil((retryAfter ?? FALLBACK_WAIT_SECONDS) / 60));
}

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

/**
 * The code step of sign-in (ADD-02): one six-digit input that checks itself on the sixth digit, the
 * resend timer, and every designed problem. A wrong code and an expired one reach us as the same
 * error from Supabase, so "expired" means a refused code more than five minutes after it was asked
 * for. Sending a new code needs a fresh human-check token, so the widget runs quietly here. The
 * limits are applied by the server actions; this component only words what they answer.
 */
export function CodeEntry({
  phone,
  sentAt,
  resendAfter,
  siteKey,
  redirectTo,
  onChangeNumber,
  onNeedsName,
}: CodeEntryProps) {
  const translate = useTranslations("auth.code");
  const translatePhone = useTranslations("auth.phone");
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<ResendNotice | null>(null);
  const [codeSentAt, setCodeSentAt] = useState(sentAt);
  const [cooldownEnd, setCooldownEnd] = useState(sentAt + resendAfter * 1000);
  const [blocked, setBlocked] = useState(false);
  const [now, setNow] = useState(sentAt);
  const [done, setDone] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [verifying, startVerify] = useTransition();
  const [resending, startResend] = useTransition();

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => goTo(redirectTo), SUCCESS_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [done, redirectTo]);

  // After a refused code, put the cursor back in the field (it is disabled while checking).
  useEffect(() => {
    if (problem && !verifying) document.getElementById(CODE_FIELD_ID)?.focus();
  }, [problem, verifying]);

  const handleCheck = useCallback((status: HumanCheckStatus, nextToken: string | null) => {
    setToken(nextToken);
    setCheckFailed(status === "failed");
  }, []);

  /** A human-check token works once, so every request for a new code starts a new check. */
  function startNewCheck() {
    setToken(null);
    setCheckFailed(false);
    setAttempt((count) => count + 1);
  }

  const remaining = Math.max(0, Math.ceil((cooldownEnd - now) / 1000));
  const locked = typeof problem === "object" && problem !== null;
  const canResend = remaining === 0 && token !== null && !resending && !verifying;
  const spoken =
    remaining === 30 || remaining === 10
      ? translate("resendSoon", { seconds: remaining })
      : remaining === 0 && cooldownEnd > sentAt
        ? translate("resendReady")
        : "";

  function verify(value: string) {
    if (value.length !== CODE_LENGTH || verifying || done || locked) return;
    setProblem(null);
    setNotice(null);
    startVerify(async () => {
      const result = await verifyPhoneCode({ phone, code: value });
      if (result.ok) {
        if (result.data.needsName) onNeedsName();
        else setDone(true);
        return;
      }
      setCode("");
      if (result.fieldErrors?.code) {
        const age = (Date.now() - codeSentAt) / 1000;
        setProblem(age >= CODE_LIFETIME_SECONDS ? "expired" : "wrong");
      } else if (result.code === "RATE_LIMITED") {
        setProblem({ problem: "locked", minutes: minutesToWait(result.retryAfter) });
      } else {
        setProblem("unavailable");
      }
    });
  }

  function resend() {
    if (!canResend || !token) return;
    setProblem(null);
    setNotice(null);
    startResend(async () => {
      const result = await sendPhoneCode({ phone, captchaToken: token });
      startNewCheck();
      const at = Date.now();
      if (result.ok) {
        setCodeSentAt(at);
        setCooldownEnd(at + result.data.resendAfter * 1000);
        setNow(at);
        setBlocked(false);
        setCode("");
        setNotice("resent");
      } else if (result.fieldErrors?.captchaToken) {
        setNotice("captchafail");
      } else if (result.code === "RATE_LIMITED") {
        setCooldownEnd(at + (result.retryAfter ?? FALLBACK_WAIT_SECONDS) * 1000);
        setNow(at);
        setBlocked(true);
        setNotice({ problem: "blocked", minutes: minutesToWait(result.retryAfter) });
      } else {
        setNotice("unavailable");
      }
    });
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <Heading as="h1" size="2">
          {translate("successTitle")}
        </Heading>
        <OtpInput value={code} disabled aria-label={translate("label")} />
        <Alert tone="success">{translate("successBody")}</Alert>
        <Button variant="accent" size="lg" className="w-full" onClick={() => goTo(redirectTo)}>
          {translate("continue")}
        </Button>
      </div>
    );
  }

  const differentNumber = (
    <Button variant="ghost" size="sm" className="inline px-0" onClick={onChangeNumber}>
      {translate("useDifferentNumber")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Heading as="h1" size="2">
          {translate("title")}
        </Heading>
        <Text variant="lead" className="mt-2">
          {withLinks(translate("sentTo", { phone: marker("phone") }), {
            phone: <b>{maskIndianMobile(phone)}</b>,
          })}
        </Text>
        <Button variant="ghost" size="sm" className="mt-1 px-0" onClick={onChangeNumber}>
          {translate("changeNumber")}
        </Button>
      </div>

      {problem === "wrong" ? (
        <Alert tone="danger" title={translate("wrongTitle")}>
          {translate("wrongBody")}
        </Alert>
      ) : null}
      {problem === "expired" ? (
        <Alert tone="warning" title={translate("expiredTitle")}>
          {translate("expiredBody")}
        </Alert>
      ) : null}
      {typeof problem === "object" && problem !== null ? (
        <Alert tone="danger" title={translate("lockedTitle")}>
          {withLinks(
            translate("lockedBody", {
              minutes: problem.minutes,
              differentNumber: marker("differentNumber"),
            }),
            { differentNumber },
          )}
        </Alert>
      ) : null}
      {problem === "unavailable" ? (
        <Alert
          tone="danger"
          title={translate("unavailableTitle")}
          action={
            <Button variant="danger-outline" size="sm" onClick={() => setProblem(null)}>
              {translate("tryAgain")}
            </Button>
          }
        >
          {translate("unavailableBody")}
        </Alert>
      ) : null}
      {notice === "resent" ? (
        <Alert tone="success" title={translate("resentTitle")}>
          {translate("resentBody")}
        </Alert>
      ) : null}
      {typeof notice === "object" && notice !== null ? (
        <Alert tone="warning" title={translate("blockedTitle")}>
          {translate("blockedBody", { minutes: notice.minutes })}
        </Alert>
      ) : null}
      {notice === "unavailable" ? (
        <Alert tone="danger" title={translatePhone("unavailableTitle")}>
          {translatePhone("unavailableBody")}
        </Alert>
      ) : null}
      {notice === "captchafail" || checkFailed ? (
        <Alert
          tone="danger"
          title={translatePhone("captchaFailedTitle")}
          action={
            <Button variant="danger-outline" size="sm" onClick={startNewCheck}>
              {translatePhone("tryAgain")}
            </Button>
          }
        >
          {translatePhone("captchaFailedBody")}
        </Alert>
      ) : null}

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          verify(code);
        }}
        className="flex flex-col gap-4"
      >
        <FormField label={translate("label")} hint={translate("hint")} id={CODE_FIELD_ID}>
          <OtpInput
            length={CODE_LENGTH}
            value={code}
            onValueChange={(value) => {
              setCode(value);
              if (problem) setProblem(null);
            }}
            onComplete={verify}
            invalid={problem === "wrong" || problem === "expired"}
            disabled={verifying || locked}
          />
        </FormField>
        <Text variant="caption" tone="muted">
          {translate("tip")}
        </Text>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          loading={verifying}
          disabled={code.length !== CODE_LENGTH || verifying || locked}
        >
          {verifying ? translate("verifying") : translate("verify")}
        </Button>
      </form>

      <div className="flex flex-wrap items-center gap-x-2 text-small text-muted">
        {remaining > 0 ? (
          <Text as="span" tone="muted">
            {blocked
              ? translate("blockedIn", { time: clock(remaining) })
              : translate("resendIn", { time: clock(remaining) })}
          </Text>
        ) : (
          <>
            <Text as="span" tone="muted">
              {translate("didntGet")}
            </Text>
            <Button variant="ghost" size="sm" disabled={!canResend} onClick={resend}>
              {translate("resend")}
            </Button>
          </>
        )}
        <VisuallyHidden aria-live="polite">{spoken}</VisuallyHidden>
      </div>
      <HumanCheck
        key={attempt}
        quiet
        siteKey={siteKey}
        onChange={handleCheck}
        onRetry={startNewCheck}
      />

      <Button variant="ghost" className="self-center" onClick={onChangeNumber}>
        {translate("differentNumber")}
      </Button>
    </div>
  );
}
