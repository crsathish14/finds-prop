"use client";

/**
 * ChatGate: the card that takes the place of the composer after the free messages are used.
 * Purpose: asks the visitor to sign in to keep chatting, quotes the message they were about to send
 *   so it is not lost, and offers one copper "Sign in" button. Owner: design system. It is the
 *   screen only: the chat island decides when to show it and keeps the transcript and the draft
 *   (sessionStorage, ADR-057 idea) for the return from sign-in.
 * Props: freeMessages (how many free messages were allowed, for the sentence), draft (the unsent
 *   message, plain text; the quote is left out when there is none), signInHref (where "Sign in"
 *   leads, asking to come back to the chat), onSignIn (called when the link is pressed, before the
 *   browser leaves: the island saves the transcript here), focusHeading (move focus to the heading
 *   when the gate appears), className.
 * Responsive: full width of the reading column; the button wraps under the hint on a phone.
 * Accessibility: a labelled region; the heading takes focus when focusHeading is set; the icon is
 *   decoration; the quoted draft is read before the button; the button is a real link.
 * States: with a draft; without a draft.
 * Dependencies: ChatDraftQuote, Button, Link, Icon, next-intl, cn.
 * Tests: chat-parts.test.tsx; Design Lab "AI chat gates".
 * UX reference: ai-chat-limits, state "gate" (addendum batch 4, ChatGate; addendum3.css .chat-gate).
 */
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { ChatDraftQuote } from "./chat-draft-quote";

type ChatGateProps = {
  freeMessages: number;
  draft?: string;
  signInHref: string;
  onSignIn?: () => void;
  focusHeading?: boolean;
  className?: string;
};

function ChatGate({
  freeMessages,
  draft,
  signInHref,
  onSignIn,
  focusHeading = false,
  className,
}: ChatGateProps) {
  const translate = useTranslations("ai");
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusHeading) headingRef.current?.focus();
  }, [focusHeading]);

  return (
    <section
      data-slot="chat-gate"
      aria-labelledby={headingId}
      className={cn(
        "grid gap-4 rounded-xl border-[length:var(--bw-field)] border-primary-tint-2 bg-surface p-5",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-14 place-items-center rounded-pill bg-info-tint text-info"
      >
        <Icon icon={Lock} size="lg" />
      </span>
      <div className="grid gap-2">
        <h2
          id={headingId}
          ref={headingRef}
          tabIndex={-1}
          className="text-h3 text-primary outline-none"
        >
          {translate("signInGateTitle")}
        </h2>
        <p className="max-w-[60ch] text-body text-muted">
          {translate("signInGateBody", { count: freeMessages })}
        </p>
      </div>
      {draft ? <ChatDraftQuote label={translate("gate.draftLabel")}>{draft}</ChatDraftQuote> : null}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button asChild variant="accent" size="lg">
          <Link href={signInHref} {...(onSignIn ? { onClick: onSignIn } : {})}>
            {translate("gate.signIn")}
          </Link>
        </Button>
        <p className="text-small text-muted">{translate("gate.hint")}</p>
      </div>
    </section>
  );
}

export { ChatGate };
export type { ChatGateProps };
