import type { LabEntry } from "../types";
import { AiCardsPageDemo } from "./ai-cards-page-demos";
import { AiChatPagerDemo } from "./ai-chat-pager-demos";
import {
  ChatComposerDemo,
  ChatConfirmCardDemo,
  ChatGatesDemo,
  ChatMessagesDemo,
  ChatNoticesDemo,
} from "./ai-chat-demos";

/**
 * The AI chat assistant's parts (P5-T01, ADR-128 section 10, UX addendum batch 4: ADD-14 to ADD-16). The
 * page that puts them together (`/ai-search`, behind `FLAG_AI_SEARCH`) comes in P5-T02. One copper button
 * per view: on the page it is the composer's Send, or the confirm card's Send while a card waits.
 */
export const AI_CHAT: LabEntry[] = [
  {
    id: "messages",
    name: "AI chat messages",
    description:
      "The thread, the visitor's bubble, the assistant's answer with cards and notes, the status line (Searching…, or the step the assistant has reached), the streaming caret and the fixed notes (cap note, disclaimer, personal details removed).",
    sources: [
      "domain/chat-thread.tsx",
      "domain/chat-user-bubble.tsx",
      "domain/chat-assistant-message.tsx",
      "domain/chat-status-line.tsx",
      "domain/chat-note-line.tsx",
    ],
    Demo: ChatMessagesDemo,
  },
  {
    id: "cards-page",
    name: "AI cards page",
    description:
      'The page of compact cards beside the chat: the cards of the answer being read, up to six on one screen with no scrolling; dots and "Answer 2 of 4" to move between answers, numbers for the pages Show more adds, and the slide-and-fade (a newer page from below, an older one from above) when the page changes.',
    sources: ["domain/ai-cards-page.client.tsx", "domain/chat-cards-line.client.tsx"],
    Demo: AiCardsPageDemo,
  },
  {
    id: "chat-pager",
    name: "AI chat pager",
    description:
      "The frame of the chat page on phones and tablets: the chat and the cards page as two full-width panes that snap (swipe sideways, a flick or a drag past about a third changes pane), the chat scrolling inside its own box, the message box under both panes, the pane out of sight inert, and a Back to the chat button on the cards pane. From lg the same two panes are columns.",
    sources: ["domain/ai-chat-pager.client.tsx"],
    Demo: AiChatPagerDemo,
  },
  {
    id: "composer",
    name: "AI chat composer",
    description:
      "The message box with Send, the personal-details note and the counter: empty, typing, off with the draft kept, forest Send and at the limit.",
    sources: ["domain/chat-composer.client.tsx"],
    Demo: ChatComposerDemo,
  },
  {
    id: "notices",
    name: "AI chat notices",
    description:
      "Error with Try again, the two rate-limited states (a short wait, the daily limit) and unavailable with a link to the filters.",
    sources: ["domain/chat-notice.tsx"],
    Demo: ChatNoticesDemo,
  },
  {
    id: "gate",
    name: "AI chat gates",
    description:
      "Sign in to keep chatting after the free messages, with the unsent message quoted, and the quote on its own.",
    sources: ["domain/chat-gate.client.tsx", "domain/chat-draft-quote.tsx"],
    Demo: ChatGatesDemo,
  },
  {
    id: "confirm-card",
    name: "AI chat confirm card",
    description:
      "The card that shows what an enquiry or a site visit will send and waits for Send: pending, sending, failed, limited, sent, already contacted, signed out and session ended.",
    sources: ["domain/chat-confirm-card.client.tsx"],
    Demo: ChatConfirmCardDemo,
  },
];
