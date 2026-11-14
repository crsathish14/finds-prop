"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { ChatAssistantMessage, ChatStreamCaret } from "@/components/domain/chat-assistant-message";
import { ChatComposer } from "@/components/domain/chat-composer.client";
import {
  ChatConfirmCard,
  type ChatConfirmTarget,
} from "@/components/domain/chat-confirm-card.client";
import { ChatGate } from "@/components/domain/chat-gate.client";
import { ChatNoteLine } from "@/components/domain/chat-note-line";
import { ChatNotice } from "@/components/domain/chat-notice";
import { ChatStatusLine } from "@/components/domain/chat-status-line";
import { ChatThread } from "@/components/domain/chat-thread";
import { ChatRemovedToken, ChatUserBubble } from "@/components/domain/chat-user-bubble";
import { ProjectCard, type ProjectCardData } from "@/components/domain/project-card";
import { PropertyCard } from "@/components/domain/property-card";
import { Specimen } from "../frame";
import { RENT_PRIME, SALE_FEATURED } from "./domain-demos";

const WIDE = "w-full max-w-205";
const NOTHING = () => undefined;
const PICTURES = "/design-lab/listings";

const PROJECT: ProjectCardData = {
  href: "#project-1",
  name: "Kadal Vista",
  developerName: "Kadal Homes",
  locality: "OMR Navalur",
  city: "Chennai",
  minRupees: 78_00_000,
  maxRupees: 1_42_00_000,
  bedrooms: [2, 3],
  status: "under_construction",
  cover: {
    src: `${PICTURES}/home-a.svg`,
    alt: "Drawn placeholder: a house with a pitched roof",
  },
};

/** The conversation: what the visitor wrote, the search status, a streaming answer, an answer with cards and notes. */
export function ChatMessagesDemo() {
  // The fixed lines come from en.json like the real chat; the rest of the messages are sample text.
  const translate = useTranslations("ai");
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="A thread: the visitor's message, an answer with two property cards and the cap note, then a message with personal details removed and the notice under it"
        className={WIDE}
      >
        <ChatThread className="w-full">
          <ChatUserBubble>3 BHK flat in Velachery under 1.5 crore</ChatUserBubble>
          <ChatAssistantMessage
            cards={
              <>
                <PropertyCard property={SALE_FEATURED} priority />
                <PropertyCard property={RENT_PRIME} priority />
              </>
            }
            notes={<ChatNoteLine>{translate("capNote")}</ChatNoteLine>}
          >
            <p>I found two homes with three bedrooms in Velachery. Both are inside your budget.</p>
          </ChatAssistantMessage>
          <ChatUserBubble
            notice={
              <ChatNoteLine align="user" live>
                {translate("maskedNotice")}
              </ChatNoteLine>
            }
          >
            Call me on <ChatRemovedToken>phone number removed</ChatRemovedToken> about 3 BHK homes
            in Adyar.
          </ChatUserBubble>
        </ChatThread>
      </Specimen>
      <Specimen label="Searching: the one fixed status line, for every tool" className={WIDE}>
        <ChatThread className="w-full">
          <ChatAssistantMessage status={<ChatStatusLine />} />
        </ChatThread>
      </Specimen>
      <Specimen
        label="Streaming: the text is busy and a caret follows the last character (it stops pulsing under reduced motion)"
        className={WIDE}
      >
        <ChatThread className="w-full">
          <ChatAssistantMessage streaming>
            <p>
              I found 3 homes with 3 bedrooms in Velachery. Two are for sale, from ₹1.25 Cr, and
              <ChatStreamCaret />
            </p>
          </ChatAssistantMessage>
        </ChatThread>
      </Specimen>
      <Specimen
        label="An answer about a project, with the card and the disclaimer note"
        className={WIDE}
      >
        <ChatThread className="w-full">
          <ChatAssistantMessage
            cards={<ProjectCard project={PROJECT} priority />}
            notes={<ChatNoteLine>{translate("disclaimer")}</ChatNoteLine>}
          >
            <p>Kadal Homes has one project that fits: Kadal Vista, on OMR at Navalur.</p>
          </ChatAssistantMessage>
        </ChatThread>
      </Specimen>
      <Specimen
        label="Fixed replies: the fallback and a refusal, as plain text from en.json (the Tamil lines are not supplied yet)"
        className={WIDE}
      >
        <ChatThread className="w-full">
          <ChatAssistantMessage>
            <p>{translate("fallback")}</p>
          </ChatAssistantMessage>
          <ChatAssistantMessage>
            <p>{translate("refuseScope")}</p>
          </ChatAssistantMessage>
        </ChatThread>
      </Specimen>
    </div>
  );
}

function ComposerSpecimen({
  label,
  startValue = "",
  disabled = false,
  busy = false,
  disabledReason,
  sendTone,
  maxLength = 1000,
}: {
  label: string;
  startValue?: string;
  disabled?: boolean;
  busy?: boolean;
  disabledReason?: string;
  sendTone?: "accent" | "primary";
  maxLength?: number;
}) {
  const [value, setValue] = useState(startValue);
  return (
    <Specimen label={label} className={WIDE}>
      <ChatComposer
        className="w-full"
        value={value}
        onChange={setValue}
        onSend={() => setValue("")}
        maxLength={maxLength}
        disabled={disabled}
        busy={busy}
        {...(disabledReason ? { disabledReason } : {})}
        {...(sendTone ? { sendTone } : {})}
      />
    </Specimen>
  );
}

/** The composer: empty (Send off), typing (try it: Enter sends, Shift+Enter adds a line), off with the draft kept, forest Send, at the limit. */
export function ChatComposerDemo() {
  return (
    <div className="flex flex-col gap-10">
      <ComposerSpecimen label="Empty: Send is off until there is text" />
      <ComposerSpecimen
        label="Typing: Send is on. Enter or Send clears the box here; Shift+Enter adds a line"
        startValue="Is there a 2 BHK flat in Adyar for rent under 30,000?"
      />
      <ComposerSpecimen
        label="Busy: the assistant is answering. Send is off, the box stays enabled so focus stays in it"
        startValue="And which of these has parking?"
        busy
      />
      <ComposerSpecimen
        label="Off because a limit is reached: the draft is kept and the reason is in words"
        disabledReason="You have reached today's message limit."
        startValue="We kept what you typed."
        disabled
      />
      <ComposerSpecimen
        label="Forest Send, used while a confirm card waits so the card's Send is the one copper button"
        startValue="Show me villas near ECR"
        sendTone="primary"
      />
      <ComposerSpecimen
        label="At the limit: the counter turns to the danger colour (limit 40 here)"
        startValue="This message is exactly forty characters"
        maxLength={40}
      />
    </div>
  );
}

/** The fixed notices above the composer. */
export function ChatNoticesDemo() {
  return (
    <div className="flex flex-col gap-6">
      <Specimen label="Error: the message is kept; Try again sends it again" className={WIDE}>
        <ChatNotice kind="error" onRetry={NOTHING} className="w-full" />
      </Specimen>
      <Specimen label="Too many messages in a short time (read at once)" className={WIDE}>
        <ChatNotice kind="too_many_messages" seconds={45} filtersHref="#" className="w-full" />
      </Specimen>
      <Specimen label="Too many messages for today (read at once)" className={WIDE}>
        <ChatNotice kind="daily_limit" className="w-full" />
      </Specimen>
      <Specimen
        label="Unavailable right now: the global limit; a link to the filters"
        className={WIDE}
      >
        <ChatNotice kind="unavailable" filtersHref="#" className="w-full" />
      </Specimen>
    </div>
  );
}

/** The sign-in gate that replaces the composer after the free messages. */
export function ChatGatesDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen
        label="After the 2 free messages: the next message is quoted so it is not lost"
        className={WIDE}
      >
        <ChatGate
          freeMessages={2}
          draft="Which of these is nearest to a metro station?"
          signInHref="#"
          onSignIn={NOTHING}
          className="w-full"
        />
      </Specimen>
      <Specimen label="With no draft to keep" className={WIDE}>
        <ChatGate freeMessages={2} signInHref="#" className="w-full" />
      </Specimen>
    </div>
  );
}

const HOME: ChatConfirmTarget = {
  title: "3 BHK apartment with clubhouse and covered parking",
  meta: "Velachery · ₹1.25 Cr",
};
const PROJECT_TARGET: ChatConfirmTarget = {
  title: "Kadal Vista",
  meta: "Kadal Homes · OMR Navalur · ₹78 L – ₹1.42 Cr",
};
const ENQUIRY = {
  kind: "enquiry",
  target: HOME,
  name: "Priya Raman",
  phone: "+91 98400 12345",
  message: "Hello, is this home still available? I would like to visit this Saturday.",
  privacyHref: "#privacy",
  signInHref: "#sign-in",
  onSend: NOTHING,
  className: "w-full",
} as const;

/** The confirm card for an enquiry and a site visit, in each state. Nothing here sends. */
export function ChatConfirmCardDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Enquiry, waiting for Send (the one copper button)" className={WIDE}>
        <ChatConfirmCard {...ENQUIRY} />
      </Specimen>
      <Specimen label="Sending: the button keeps its width and its label" className={WIDE}>
        <ChatConfirmCard {...ENQUIRY} state="sending" />
      </Specimen>
      <Specimen
        label="Send failed: the alert is above the card and the details are kept"
        className={WIDE}
      >
        <ChatConfirmCard {...ENQUIRY} problem="failed" />
      </Specimen>
      <Specimen label="Too many enquiries today: Send is off" className={WIDE}>
        <ChatConfirmCard {...ENQUIRY} problem="limited" />
      </Specimen>
      <Specimen label="Sent: calm, with no copper button" className={WIDE}>
        <ChatConfirmCard {...ENQUIRY} state="sent" enquiriesHref="#enquiries" />
      </Specimen>
      <Specimen label="Already contacted: the card is not offered again" className={WIDE}>
        <ChatConfirmCard {...ENQUIRY} state="already" enquiriesHref="#enquiries" />
      </Specimen>
      <Specimen
        label="Signed out: the message is kept and the card asks to sign in"
        className={WIDE}
      >
        <ChatConfirmCard {...ENQUIRY} state="signed_out" />
      </Specimen>
      <Specimen label="Session ended while the card was open" className={WIDE}>
        <ChatConfirmCard {...ENQUIRY} state="ended" />
      </Specimen>
      <Specimen label="Site visit request for a project" className={WIDE}>
        <ChatConfirmCard
          kind="visit"
          target={PROJECT_TARGET}
          name="Priya Raman"
          phone="+91 98400 12345"
          visitDate="Sat, 14 Nov 2026"
          builderName="Kadal Homes"
          message="I'd like to see the 3 BHK show flat."
          privacyHref="#privacy"
          onSend={NOTHING}
          className="w-full"
        />
      </Specimen>
    </div>
  );
}
