"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useState, useTransition, type FormEvent } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { PhoneField } from "@/components/patterns/phone-field";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { classifyPhoneInput, typedDialCode } from "@/lib/phone";
import { sendPhoneCode } from "./actions";
import { AuthFrame } from "./auth-frame";
import { CodeEntry } from "./code-entry.client";
import { HumanCheck, type HumanCheckStatus } from "./human-check.client";
import { EmailStep } from "./email-step.client";
import { NameStep } from "./name-step.client";
import { marker, withLinks } from "./with-links";

type Problem =
  | "invalid"
  | "unsupported"
  | "captchafail"
  | "unavailable"
  | { problem: "rateLimited"; minutes: number };

type PhoneSignInProps = {
  siteKey: string | undefined;
  /** The visitor was sent here by an action that needs an account (?gate=enquire). */
  gate: boolean;
  /** Where to go once signed in: an address the page has already checked (BR-06). */
  redirectTo: string;
};

function minutesToWait(retryAfter: number | undefined): number {
  return Math.max(1, Math.ceil((retryAfter ?? 600) / 60));
}

/**
 * The card on the sign-in page (ADD-01): the mobile number, the human check and "Send code", with
 * every designed problem state. The number is checked here for a quick answer and again on the
 * server, which also applies the limits (R-BE-03). Once a code is sent the card moves to the code
 * step; the number itself is kept in this component and never goes into the address (R-BE-10).
 */
export function PhoneSignIn({ siteKey, gate, redirectTo }: PhoneSignInProps) {
  const translate = useTranslations("auth.phone");
  const translateValidation = useTranslations("validation");
  const [phone, setPhone] = useState("");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checkFailed, setCheckFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sent, setSent] = useState<{ phone: string; sentAt: number; resendAfter: number } | null>(
    null,
  );
  const [naming, setNaming] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleCheck = useCallback((status: HumanCheckStatus, nextToken: string | null) => {
    setToken(nextToken);
    setCheckFailed(status === "failed");
    if (status === "verified")
      setProblem((current) => (current === "captchafail" ? null : current));
  }, []);

  /** A human-check token works once, so every request, successful or not, starts a new check. */
  function startNewCheck() {
    setToken(null);
    setCheckFailed(false);
    setAttempt((count) => count + 1);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const checked = classifyPhoneInput(phone);
    if (checked.kind !== "valid") {
      setProblem(checked.kind);
      return;
    }
    setProblem(null);
    startTransition(async () => {
      const result = await sendPhoneCode({ phone, captchaToken: token });
      startNewCheck();
      if (result.ok) {
        setSent({
          phone: checked.e164,
          sentAt: Date.now(),
          resendAfter: result.data.resendAfter,
        });
        return;
      }
      const phoneKey = result.fieldErrors?.phone?.[0]?.key;
      if (result.fieldErrors?.captchaToken) setProblem("captchafail");
      else if (phoneKey === "validation.phoneUnsupported") setProblem("unsupported");
      else if (phoneKey) setProblem("invalid");
      else if (result.code === "RATE_LIMITED")
        setProblem({ problem: "rateLimited", minutes: minutesToWait(result.retryAfter) });
      else setProblem("unavailable");
    });
  }

  const rateLimited = typeof problem === "object" && problem !== null;
  const phoneProblem = problem === "invalid" || problem === "unsupported" ? problem : null;
  const dialCode = problem === "unsupported" ? typedDialCode(phone) : null;
  const canSend = token !== null && !rateLimited && !pending;

  const phoneStep = (
    <div className="flex flex-col gap-4">
      <div>
        <Heading as="h1" size="2">
          {translate("title")}
        </Heading>
        <Text variant="lead" className="mt-2">
          {translate("lead")}
        </Text>
      </div>

      {gate ? (
        <Alert tone="info" title={translate("gateTitle")}>
          {translate("gateBody")}
        </Alert>
      ) : null}
      {rateLimited ? (
        <Alert tone="warning" title={translate("rateLimitedTitle")}>
          {translate("rateLimitedBody", { minutes: problem.minutes })}
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
      {problem === "captchafail" || checkFailed ? (
        <Alert tone="danger" title={translate("captchaFailedTitle")}>
          {translate("captchaFailedBody")}
        </Alert>
      ) : null}

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField
          label={translate("label")}
          {...(phoneProblem ? {} : { hint: translate("hint") })}
          {...(phoneProblem
            ? {
                error: translateValidation(
                  phoneProblem === "invalid" ? "phoneInvalid" : "phoneUnsupported",
                ),
              }
            : {})}
        >
          {dialCode ? (
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              leading={<span className="text-body font-semibold text-ink">{dialCode}</span>}
              className="pl-18"
              invalid
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                setProblem(null);
              }}
            />
          ) : (
            <PhoneField
              placeholder={translate("placeholder")}
              invalid={phoneProblem !== null}
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value);
                if (phoneProblem) setProblem(null);
              }}
            />
          )}
        </FormField>

        <HumanCheck
          key={attempt}
          siteKey={siteKey}
          onChange={handleCheck}
          onRetry={startNewCheck}
        />

        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          loading={pending}
          disabled={!canSend}
        >
          {pending ? translate("sending") : translate("send")}
        </Button>

        <Text variant="caption" tone="muted">
          {withLinks(translate("consent", { terms: marker("terms"), privacy: marker("privacy") }), {
            terms: <Link href="/terms">{translate("termsLink")}</Link>,
            privacy: <Link href="/privacy">{translate("privacyLink")}</Link>,
          })}
        </Text>
      </form>

      <div className="flex flex-col items-center gap-2 text-center">
        <Text as="span">
          {withLinks(translate("builderPrompt", { signIn: marker("signIn") }), {
            signIn: <Link href="/builder/login">{translate("builderLink")}</Link>,
          })}
        </Text>
        <Link href="/" className="inline-flex items-center gap-2">
          <Icon icon={ArrowLeft} size="sm" />
          {translate("backLink")}
        </Link>
      </div>
    </div>
  );

  if (emailing) {
    return (
      <AuthFrame step="email">
        <EmailStep redirectTo={redirectTo} />
      </AuthFrame>
    );
  }

  if (naming) {
    return (
      <div className="mx-auto w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-card md:p-8">
        <NameStep reason="signup" onDone={() => setEmailing(true)} />
      </div>
    );
  }

  return (
    <AuthFrame step={sent ? "code" : "phone"}>
      {sent ? (
        <CodeEntry
          phone={sent.phone}
          sentAt={sent.sentAt}
          resendAfter={sent.resendAfter}
          siteKey={siteKey}
          redirectTo={redirectTo}
          onChangeNumber={() => setSent(null)}
          onNeedsName={() => setNaming(true)}
        />
      ) : (
        phoneStep
      )}
    </AuthFrame>
  );
}
