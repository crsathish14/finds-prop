"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Heading } from "@/components/ui/heading";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import { FEEDBACK_MESSAGE_MAX } from "./constants";

export type FeedbackFormActions = {
  send: (input: { message: string }) => Promise<ActionResult<unknown>>;
};

const PANEL = "rounded-xl border border-line bg-surface p-6 shadow-card";

/**
 * The builder's Feedback page (change request, plan 6): one message box and a Send button. Message only: plain text,
 * up to 1000 characters, with a counter. The box is cleared after a message is sent; a refusal (a limit reached, a
 * message that is not valid) is shown without clearing what was typed.
 */
export function FeedbackForm({ actions }: { actions: FeedbackFormActions }) {
  const translate = useTranslations("builderPortal.feedback");
  const everything = useTranslations() as unknown as Translator;
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      const result = await actions.send({ message });
      if (!result.ok) {
        const problem = result.fieldErrors?.message?.[0];
        if (problem) setError(fieldErrorText(everything, problem));
        else notify.error(failureText(everything, result));
        return;
      }
      setError(undefined);
      setMessage("");
      notify.success(translate("toast.title"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="1">
          {translate("title")}
        </Heading>
        <Text tone="muted">{translate("intro")}</Text>
      </div>
      <section aria-labelledby="feedback-heading" className={PANEL}>
        <Heading as="h2" size="3" id="feedback-heading" className="mb-4">
          {translate("formTitle")}
        </Heading>
        <form noValidate onSubmit={submit} className="flex max-w-2xl flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="feedback-message">{translate("messageLabel")}</Label>
            <Textarea
              id="feedback-message"
              name="message"
              value={message}
              maxLength={FEEDBACK_MESSAGE_MAX}
              invalid={error !== undefined}
              aria-describedby={error ? "feedback-message-error" : undefined}
              disabled={sending}
              placeholder={translate("messagePlaceholder")}
              counter={translate("counter", {
                count: message.length,
                maximum: FEEDBACK_MESSAGE_MAX,
              })}
              onChange={(event) => {
                setMessage(event.target.value);
                setError(undefined);
              }}
            />
            {error ? (
              <Text
                id="feedback-message-error"
                variant="small"
                tone="inherit"
                role="alert"
                className="text-danger-text"
              >
                {error}
              </Text>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              variant="primary"
              loading={sending}
              disabled={message.trim().length === 0}
            >
              {translate(sending ? "sending" : "send")}
            </Button>
            <Text variant="small" tone="muted">
              {translate("note")}
            </Text>
          </div>
        </form>
      </section>
    </div>
  );
}
