"use client";

import { ArrowLeft, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition, type FormEvent } from "react";
import { Alert } from "@/components/patterns/alert";
import { FormField } from "@/components/patterns/form-field";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Link } from "@/components/ui/link";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { saveProfileName } from "./actions";
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH } from "./constants";
import { goTo } from "./navigate";

/**
 * Why the visitor is being asked: right after a first sign-in ("signup"), or because they tried to
 * post a property or contact an owner without a name. Only "signup" is reached today; the other two
 * are designed states that the posting and enquiry features will use (ADD-04).
 */
export type NameReason = "signup" | "post" | "enquire";

type NameStepProps = {
  reason: NameReason;
  /** Where to go once the name is saved, or skipped: an address the page has already checked (BR-06). */
  redirectTo: string;
};

/**
 * The name step (ADD-04): one field, saved on the visitor's own profile. The quick check here only
 * saves a round trip; the server checks the name again and decides whose profile it is from the
 * session. A name is never needed to browse, so after a sign-in the visitor may skip it and will be
 * asked again before posting or enquiring. Words come from en.json.
 */
export function NameStep({ reason, redirectTo }: NameStepProps) {
  const translate = useTranslations("auth.name");
  // The same cast the helper's own test uses: next-intl's strict translator type is wider than Translator.
  const translateAll = useTranslations() as unknown as Translator;
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const busy = pending || saved;
  const asked = reason === "signup";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (name.trim().replace(/\s+/g, " ").length < NAME_MIN_LENGTH) {
      setError(translateAll("validation.nameTooShort"));
      return;
    }
    setError(null);
    setFailure(null);
    startTransition(async () => {
      const result = await saveProfileName({ name });
      if (result.ok) {
        // Stay in the busy state until the browser has left the page.
        setSaved(true);
        goTo(redirectTo);
        return;
      }
      const fieldError = result.fieldErrors?.name?.[0];
      if (fieldError) setError(fieldErrorText(translateAll, fieldError));
      else setFailure(failureText(translateAll, result));
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <span
        className={cn(
          "grid size-12 place-items-center rounded-pill",
          asked ? "bg-success-tint text-success" : "bg-info-tint text-info",
        )}
      >
        <Icon icon={User} />
      </span>
      <div>
        <Heading as="h1" size="2">
          {translate(
            reason === "post" ? "postTitle" : reason === "enquire" ? "enquireTitle" : "title",
          )}
        </Heading>
        <Text variant="lead" className="mt-2">
          {translate(
            reason === "post" ? "postLead" : reason === "enquire" ? "enquireLead" : "lead",
          )}
        </Text>
      </div>

      {failure ? <Alert tone="danger">{failure}</Alert> : null}

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField
          label={translate("label")}
          required
          hint={translate("counter", { count: name.length, max: NAME_MAX_LENGTH })}
          {...(error ? { error } : {})}
        >
          <Input
            name="name"
            autoComplete="name"
            placeholder={translate("placeholder")}
            maxLength={NAME_MAX_LENGTH}
            invalid={error !== null}
            disabled={busy}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
          />
        </FormField>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="w-full"
          loading={busy}
          disabled={busy}
        >
          {busy ? translate("saving") : translate("save")}
        </Button>
      </form>

      {asked ? (
        <div className="flex flex-col items-center gap-1 text-center">
          <Button variant="ghost" onClick={() => goTo(redirectTo)} disabled={busy}>
            {translate("skip")}
          </Button>
          <Text variant="caption" tone="muted">
            {translate("askAgain")}
          </Text>
        </div>
      ) : (
        <p className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Icon icon={ArrowLeft} size="sm" />
            {translate("back")}
          </Link>
        </p>
      )}
    </div>
  );
}
