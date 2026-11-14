"use client";

/**
 * ChatConfirmCard: the card in the chat that shows exactly what an enquiry or a site visit request
 * will send, and waits for the visitor to press Send.
 * Purpose: the one place where the chat writes anything for the visitor (ADR-128 D-ACTION). The
 *   assistant only proposes; nothing is sent until the visitor presses Send on this card, and typing
 *   "yes" in the composer never sends. Owner: design system. It is the screen only: the server builds
 *   the proposal from the real record and the sending action is wired in P6-T02 (consent text and
 *   write path); this card draws what it is given and calls `onSend`.
 * Props: kind ("enquiry" | "visit"), target ({ title, meta, thumbnail }: the real home or project,
 *   already formatted; thumbnail is an optional picture node), name and phone (the visitor's own,
 *   from the account; the phone is shown in full), message (the text that will be sent), privacyHref
 *   (the consent line's Privacy Policy link), onSend, focusHeading (move focus to the heading when
 *   the card appears and when it turns into the sent or sign-in card, never when it only starts or stops sending; the
 *   "already" notice has no heading, so the page moves focus to it itself), className. For "enquiry": state ("pending" default | "sending" | "sent" |
 *   "already" | "signed_out" | "ended"), problem ("failed" draws the "couldn't send" alert, values
 *   kept; "limited" draws the "please wait" alert and switches Send off), enquiriesHref ("View my
 *   enquiries"), signInHref (required: "Sign in to send" and "Sign in again" lead there). For "visit": state ("pending" |
 *   "sending"), visitDate (already formatted) and builderName (named in the consent sentence).
 * Responsive: full width of the reading column; the facts stack on a phone and sit in two columns
 *   from 768 px; Send is as wide as the card.
 * Accessibility: a labelled region; the heading takes focus when focusHeading is set; facts are a
 *   description list of plain text; "Verified" is a badge with a word; Send is a real button (loading
 *   keeps its label, sets aria-busy and ignores clicks); the sent card is role="status"; the failed
 *   and limited alerts are announced by Alert; the kept message is read before the sign-in button.
 *   One copper button at most (R-FE-08): Send, or Sign in; the sent card has none.
 * States: pending, sending, send failed (alert above), too many enquiries today (alert above, Send
 *   off), sent, already contacted (alert and the target only), signed out, session ended; the visit
 *   card in pending and sending.
 * Dependencies: Alert, Badge, Button, Link, Icon, ChatDraftQuote, next-intl, cn.
 * Tests: chat-parts.test.tsx; Design Lab "AI chat confirm card".
 * UX reference: ai-chat-confirm (addendum batch 4, ConfirmCard; addendum3.css .confirm).
 */
import { CalendarDays, CircleCheck, Clock, Lock, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Alert } from "@/components/patterns/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon, type LucideIcon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/cn";
import { ChatDraftQuote } from "./chat-draft-quote";

type ChatConfirmTarget = { title: string; meta: string; thumbnail?: ReactNode };

type ChatConfirmCommon = {
  target: ChatConfirmTarget;
  name: string;
  phone: string;
  message: string;
  privacyHref: string;
  onSend?: () => void;
  focusHeading?: boolean;
  className?: string;
};

type ChatConfirmEnquiry = ChatConfirmCommon & {
  kind: "enquiry";
  state?: "pending" | "sending" | "sent" | "already" | "signed_out" | "ended";
  problem?: "failed" | "limited";
  enquiriesHref?: string;
  signInHref: string;
};

type ChatConfirmVisit = ChatConfirmCommon & {
  kind: "visit";
  state?: "pending" | "sending";
  visitDate: string;
  builderName: string;
};

type ChatConfirmCardProps = ChatConfirmEnquiry | ChatConfirmVisit;

function TargetChip({ target }: { target: ChatConfirmTarget }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-canvas p-2">
      <span
        aria-hidden="true"
        className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-sm bg-canvas-sunken"
      >
        {target.thumbnail}
      </span>
      <div className="min-w-0">
        <p className="text-small font-bold text-ink [overflow-wrap:anywhere]">{target.title}</p>
        <p className="text-caption text-muted [overflow-wrap:anywhere]">{target.meta}</p>
      </div>
    </div>
  );
}

function IconDisc({ icon, tone }: { icon: LucideIcon; tone: "info" | "success" | "warning" }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-14 place-items-center rounded-pill",
        tone === "info" && "bg-info-tint text-info",
        tone === "success" && "bg-success-tint text-success",
        tone === "warning" && "bg-warning-tint text-warning",
      )}
    >
      <Icon icon={icon} size="lg" />
    </span>
  );
}

const CARD = "grid gap-4 rounded-xl border-[length:var(--bw-field)] bg-surface p-5";

function ChatConfirmCard(props: ChatConfirmCardProps) {
  const {
    target,
    name,
    phone,
    message,
    privacyHref,
    onSend,
    focusHeading = false,
    className,
  } = props;
  const translate = useTranslations("ai.confirm");
  const enquiry = useTranslations("domain.enquiry");
  const sessionEnded = useTranslations("domain.sessionEnded");
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const state = props.state ?? "pending";
  const previousState = useRef<string | null>(null);
  useEffect(() => {
    // Focus goes to the heading when the card appears, and when it turns into another card with its own
    // heading (sent, sign in). Not on pending to sending and back: focus stays on Send, which is announced as busy.
    const previous = previousState.current;
    previousState.current = state;
    if (!focusHeading) return;
    if (previous === null || state === "sent" || state === "signed_out" || state === "ended") {
      headingRef.current?.focus();
    }
  }, [focusHeading, state]);

  const heading = (text: string) => (
    <h2 id={headingId} ref={headingRef} tabIndex={-1} className="text-h3 text-primary outline-none">
      {text}
    </h2>
  );
  const notSent = <Badge tone="neutral">{translate("notSent")}</Badge>;

  if (props.kind === "enquiry" && props.state === "already") {
    return (
      <div data-slot="chat-confirm-card" className={cn("grid gap-3", className)}>
        <Alert
          tone="info"
          title={enquiry("already.title")}
          action={
            props.enquiriesHref ? (
              <Button asChild variant="secondary" size="sm">
                <Link
                  href={props.enquiriesHref}
                  className="text-primary no-underline hover:text-primary"
                >
                  {enquiry("sent.viewEnquiries")}
                </Link>
              </Button>
            ) : undefined
          }
        >
          {enquiry("already.body")}
        </Alert>
        <TargetChip target={target} />
      </div>
    );
  }

  if (props.kind === "enquiry" && props.state === "sent") {
    return (
      <section
        data-slot="chat-confirm-card"
        role="status"
        aria-labelledby={headingId}
        className={cn(CARD, "border-line-strong", className)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <IconDisc icon={CircleCheck} tone="success" />
          <Badge tone="success" dot>
            {translate("sentBadge")}
          </Badge>
        </div>
        <div className="grid gap-2">
          {heading(enquiry("sent.title"))}
          <p className="max-w-[60ch] text-body text-muted">{enquiry("sent.body")}</p>
        </div>
        <TargetChip target={target} />
        {props.enquiriesHref ? (
          <div>
            <Button asChild variant="secondary">
              <Link
                href={props.enquiriesHref}
                className="text-primary no-underline hover:text-primary"
              >
                {enquiry("sent.viewEnquiries")}
              </Link>
            </Button>
          </div>
        ) : null}
      </section>
    );
  }

  if (props.kind === "enquiry" && (props.state === "signed_out" || props.state === "ended")) {
    const ended = props.state === "ended";
    return (
      <section
        data-slot="chat-confirm-card"
        aria-labelledby={headingId}
        className={cn(CARD, "border-primary", className)}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <IconDisc icon={ended ? Clock : Lock} tone={ended ? "warning" : "info"} />
          {notSent}
        </div>
        <div className="grid gap-2">
          {heading(ended ? sessionEnded("title") : translate("signedOutTitle"))}
          <p className="max-w-[60ch] text-body text-muted">
            {ended ? sessionEnded("body") : translate("signedOutBody")}
          </p>
        </div>
        <TargetChip target={target} />
        <ChatDraftQuote label={translate("draftLabel")}>{message}</ChatDraftQuote>
        <Button asChild variant="accent" size="lg" className="w-full">
          <Link href={props.signInHref}>
            {ended ? sessionEnded("action") : translate("signInToSend")}
          </Link>
        </Button>
      </section>
    );
  }

  const isVisit = props.kind === "visit";
  const sending = state === "sending";
  const limited = props.kind === "enquiry" && props.problem === "limited";
  const failed = props.kind === "enquiry" && props.problem === "failed";
  const consent = isVisit
    ? translate("visitConsent", { builder: props.builderName })
    : enquiry("consent.text");

  const facts: { label: string; value: ReactNode }[] = [
    { label: translate("yourName"), value: name },
    {
      label: translate("yourPhone"),
      value: (
        <>
          <span className="tabular-nums">{phone}</span>
          <Badge tone="success">
            <Icon icon={CircleCheck} size="sm" />
            {translate("verified")}
          </Badge>
        </>
      ),
    },
    ...(isVisit ? [{ label: translate("visitDate"), value: props.visitDate }] : []),
    {
      label: translate("message"),
      value: (
        <span className="w-full basis-full rounded-md border border-line bg-canvas px-4 py-3 text-body font-medium [overflow-wrap:anywhere]">
          {message}
        </span>
      ),
    },
  ];

  return (
    <div data-slot="chat-confirm-card" className={cn("grid gap-3", className)}>
      {failed ? (
        <Alert tone="danger" title={enquiry("failed.title")}>
          {enquiry("failed.body")}
        </Alert>
      ) : null}
      {limited ? (
        <Alert tone="warning" urgent title={enquiry("rateLimit.title")}>
          {enquiry("rateLimit.body")}
        </Alert>
      ) : null}
      <section aria-labelledby={headingId} className={cn(CARD, "border-primary shadow-card")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {heading(translate(isVisit ? "visitTitle" : "enquiryTitle"))}
          {notSent}
        </div>
        <TargetChip target={target} />
        <dl className="grid gap-3">
          {facts.map((fact) => (
            <div key={fact.label} className="grid gap-1 md:grid-cols-4 md:items-start md:gap-4">
              <dt className="text-small font-semibold text-muted">{fact.label}</dt>
              <dd className="flex flex-wrap items-center gap-2 text-body font-semibold text-ink md:col-span-3 [overflow-wrap:anywhere]">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
        <p className="text-caption text-muted">
          {consent} <Link href={privacyHref}>{enquiry("consent.privacy")}</Link>
        </p>
        <div className="grid gap-2">
          <Button
            type="button"
            variant="accent"
            size="lg"
            className="w-full"
            loading={sending}
            disabled={limited}
            iconStart={<Icon icon={isVisit ? CalendarDays : Send} />}
            {...(onSend ? { onClick: onSend } : {})}
          >
            {isVisit ? translate("requestVisit") : enquiry("form.send")}
          </Button>
          {sending ? null : (
            <p className="text-center text-caption text-muted">{translate("hint")}</p>
          )}
        </div>
      </section>
    </div>
  );
}

export { ChatConfirmCard };
export type { ChatConfirmCardProps, ChatConfirmTarget };
