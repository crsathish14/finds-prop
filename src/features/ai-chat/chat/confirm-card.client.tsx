"use client";

import { useState, useTransition } from "react";
import { ChatConfirmCard } from "@/components/domain/chat-confirm-card.client";
import { sessionEndedHref, isSessionEnded } from "@/lib/session-ended";
import type { ActionResult } from "@/types/action";
import { confirmChatProposal } from "../actions";
import type { ConfirmCard } from "../confirm/confirm-card";

/** Where "Sign in to send" leads: the phone sign-in, asked to come back to the chat (ADR-128 section 6.3). */
export const CHAT_SIGN_IN_HREF = "/auth?redirect=%2Fai-search";
/** The chat page: the way back after "Sign in again" (the address only, never a query). */
const CHAT_PATH = "/ai-search";
const PRIVACY_HREF = "/privacy";
const ENQUIRIES_HREF = "/dashboard?tab=sent";

/** The button's action, as the page hands it over (the server action `confirmChatProposal`). */
export type ConfirmProposalAction = (input: {
  proposal: string;
  idempotencyKey: string;
}) => Promise<ActionResult<{ received: true }>>;

type Outcome = "pending" | "sent" | "already" | "ended";
type Problem = "failed" | "limited" | "expired" | undefined;

/**
 * The confirm card of the chat, wired to the server (AI-P6-T02, ADR-128 D-ACTION). It draws what the server built
 * (`confirm/build-card.ts`) and does one thing: when Send is pressed, it sends the signed proposal and a fresh
 * idempotency key made when the card appeared to `confirmChatProposal`, which checks the proposal again for the
 * signed-in customer and runs the existing action. Nothing here says who is sending, and nothing but this button
 * sends: typing in the chat never does.
 *
 * What comes back is drawn as on the enquiry form: sent, "already contacted" (an enquiry about this home within 24
 * hours), "please wait" (too many today), the session ended (the card keeps the message for the way back: pressing
 * "Sign in again" hands it to `onKeepMessage`), a request that is no longer valid (expired, changed or not open any
 * more), or "couldn't send" for anything else, with the card as it was so Send can be pressed again. One key per
 * card, so a second press, however it comes, stores one enquiry or lead.
 */
export function ChatConfirm({
  card,
  focusHeading = false,
  onKeepMessage,
  send = confirmChatProposal,
}: {
  card: ConfirmCard;
  focusHeading?: boolean;
  /** Called when the customer leaves to sign in, with the message the card holds, so the chat can bring it back. */
  onKeepMessage: (message: string) => void;
  send?: ConfirmProposalAction;
}) {
  const [key] = useState(() => crypto.randomUUID());
  const [outcome, setOutcome] = useState<Outcome>("pending");
  const [problem, setProblem] = useState<Problem>(undefined);
  const [pending, startTransition] = useTransition();

  const facts = {
    target: card.target,
    message: card.message,
    privacyHref: PRIVACY_HREF,
    focusHeading,
    onSignIn: () => onKeepMessage(card.message),
  };
  const visit =
    card.kind === "visit"
      ? {
          kind: "visit" as const,
          visitDate: card.visitDate ?? "",
          builderName: card.builderName ?? "",
        }
      : null;

  if (card.state === "signed_out") {
    return visit ? (
      <ChatConfirmCard
        {...facts}
        {...visit}
        name=""
        phone=""
        state="signed_out"
        signInHref={CHAT_SIGN_IN_HREF}
      />
    ) : (
      <ChatConfirmCard
        {...facts}
        kind="enquiry"
        name=""
        phone=""
        state="signed_out"
        signInHref={CHAT_SIGN_IN_HREF}
      />
    );
  }

  const proposal = card.proposal;
  function press() {
    if (pending || outcome === "sent" || outcome === "already") return;
    setProblem(undefined);
    startTransition(async () => {
      try {
        const result = await send({ proposal, idempotencyKey: key });
        if (result.ok) {
          setOutcome("sent");
        } else if (isSessionEnded(result)) {
          setOutcome("ended");
        } else if (
          result.code === "CONFLICT" &&
          card.kind === "enquiry" &&
          card.about !== "project"
        ) {
          setOutcome("already");
        } else if (result.code === "RATE_LIMITED") {
          setProblem("limited");
        } else if (result.code === "NOT_FOUND") {
          setProblem("expired");
        } else {
          setProblem("failed");
        }
      } catch {
        // The request did not get through (offline, server down): say so; the card stays as it was.
        setProblem("failed");
      }
    });
  }

  const common = {
    ...facts,
    name: card.name,
    phone: card.phone,
    state: pending ? ("sending" as const) : outcome === "pending" ? ("pending" as const) : outcome,
    ...(problem === undefined ? {} : { problem }),
    signInHref: sessionEndedHref(CHAT_PATH),
    onSend: press,
  };
  return visit ? (
    <ChatConfirmCard
      {...common}
      {...visit}
      state={common.state === "already" ? "pending" : common.state}
    />
  ) : (
    <ChatConfirmCard
      {...common}
      kind="enquiry"
      {...(card.about === "project" ? {} : { enquiriesHref: ENQUIRIES_HREF })}
    />
  );
}
