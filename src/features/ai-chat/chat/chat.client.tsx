"use client";

import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Alert } from "@/components/patterns/alert";
import { ChatAssistantMessage, ChatStreamCaret } from "@/components/domain/chat-assistant-message";
import { ChatComposer } from "@/components/domain/chat-composer.client";
import { ChatGate } from "@/components/domain/chat-gate.client";
import { ChatNoteLine } from "@/components/domain/chat-note-line";
import { ChatNotice } from "@/components/domain/chat-notice";
import { ChatStatusLine } from "@/components/domain/chat-status-line";
import { ChatThread } from "@/components/domain/chat-thread";
import { ChatUserBubble } from "@/components/domain/chat-user-bubble";
import { Chip } from "@/components/ui/chip";
import { Heading } from "@/components/ui/heading";
import { Icon } from "@/components/ui/icon";
import { Link } from "@/components/ui/link";
import { isSiteLinkPath } from "../site-links";
import { isSourcePath } from "../source-links";
import { Text } from "@/components/ui/text";
import {
  AI_MAX_CARDS_PER_ANSWER,
  AI_MAX_SOURCES_PER_ANSWER,
  AI_TRIAL_MESSAGES,
  MAX_INPUT_CHARACTERS,
} from "@/config/ai";
import { saveDraft } from "@/lib/form-draft";
import { useRestoredDraft, useRestoredNotice } from "@/lib/use-restored-draft";
import type { ChatContext } from "../context/page-context";
import type { ConfirmCard } from "../confirm/confirm-card";
import { AnswerCards, type ChatCardControls } from "./answer-cards.client";
import {
  browserStorage,
  EMPTY_CHAT,
  buildHistory,
  contextField,
  isSeeAllPath,
  messageTime,
  sentenceParts,
  shownRecords,
  loadChat,
  MASKED_NOTICE_KEY,
  safeHref,
  saveChat,
  type AssistantEntry,
  type ChatEntry,
  type ChatNote,
  type ChatReference,
  type ChatSource,
} from "./chat-model";
import { readChatEvents, readChatFailure } from "./chat-stream";
import { ChatConfirm } from "./confirm-card.client";
import { takeHomeQuestion } from "./home-question";
import { afterKeyboardCloses, isTouchScreen } from "./keyboard";

/** Where the sign-in gate leads: the phone sign-in, asked to come back to this page (ADR-128 section 10). */
const SIGN_IN_HREF = "/auth?redirect=%2Fai-search";

/** The normal search, offered by the limit notices and the fixed fallback. */
const FILTERS_HREF = "/properties";

const COMPOSER_ID = "ai-chat-message";

/** The space kept between the newest words and the composer when the page scrolls to them, in pixels. */
const NEWEST_BREATHING_ROOM = 16;

/** The name the unsent message of a confirm card is kept under while the customer signs in (the way forms keep theirs). */
const CONFIRM_DRAFT_NAME = "ai-chat-confirm";

/** What the assistant has written so far for the message in flight. */
type LiveAnswer = {
  /** The id the answer will keep once it is whole, so the screen keeps the same card in place when it ends. */
  id: string;
  text: string;
  confirm: ConfirmCard | undefined;
  notes: ChatNote[];
  references: ChatReference[];
  links: { text: string; href: string }[];
  sources: ChatSource[];
  /** The reply buttons the server offered under this answer. */
  replies: { key: string; text: string }[];
  /** The "See all" link of a home search (ADR-206). */
  seeAll: { text: string; href: string } | undefined;
  replaced: boolean;
  href: string | undefined;
  /** The latest status line the server sent (ADR-217), shown until the answer starts. */
  status?: string | undefined;
};

/** What went wrong with the last message, so the notice and the composer can say it. */
type Problem =
  | { kind: "error"; text: string; userId: string }
  | { kind: "too_many_messages"; seconds: number }
  | { kind: "daily_limit" }
  | { kind: "unavailable" };

const NO_ANSWER: Omit<LiveAnswer, "id"> = {
  text: "",
  confirm: undefined,
  notes: [],
  references: [],
  links: [],
  sources: [],
  replies: [],
  seeAll: undefined,
  replaced: false,
  href: undefined,
};

/** The time of a message the visitor sends, from the browser's clock (kept outside the component: it is not a render value). */
function sentAt(): number {
  return Date.now();
}

let counter = 0;
function newId(): string {
  counter += 1;
  return `m${Date.now().toString(36)}${counter}`;
}

function paragraphs(text: string): string[] {
  return text.split(/\n{2,}/).filter((paragraph) => paragraph.trim() !== "");
}

function AnswerText({ text, caret = false }: { text: string; caret?: boolean }) {
  const parts = paragraphs(text);
  return (
    <>
      {parts.map((paragraph, index) => (
        <p key={index} className="whitespace-pre-line">
          {sentenceParts(paragraph.trim()).map((part, position) =>
            part.question ? (
              <strong key={position} className="font-bold">
                {part.text}
              </strong>
            ) : (
              part.text
            ),
          )}
          {caret && index === parts.length - 1 ? <ChatStreamCaret /> : null}
        </p>
      ))}
    </>
  );
}

/**
 * The "Sources" row of a content answer (ADR-143 section 6.5): the articles and questions it drew on, each a link the
 * server built (`source-links.ts`) and the browser draws only when the address is one of those shapes. Nothing is
 * drawn for an answer with no source.
 */
function sourceRow(sources: readonly ChatSource[], label: string) {
  const shown = sources
    .filter((source) => isSourcePath(source.href))
    .slice(0, AI_MAX_SOURCES_PER_ANSWER);
  if (shown.length === 0) return null;
  return (
    <div className="mt-3" data-slot="chat-sources">
      <Text variant="caption" tone="muted" className="font-bold">
        {label}
      </Text>
      <ul className="mt-1 flex flex-col gap-1">
        {shown.map((source) => (
          <li key={source.href}>
            <Link href={source.href} variant="arrow">
              {source.title}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The text, the cards and the notes of one answer, as the parts of a `ChatAssistantMessage`. */
function answerParts(
  entry: Pick<
    AssistantEntry,
    "text" | "notes" | "references" | "links" | "sources" | "replaced" | "href" | "confirm"
  > & { seeAll?: { text: string; href: string } | undefined },
  filtersLabel: string,
  sourcesLabel: string,
  streaming: boolean,
  controls: ChatCardControls,
  keepMessage: (message: string) => void,
) {
  const href = safeHref(entry.href);
  return {
    text:
      entry.text === "" ? null : (
        <>
          <AnswerText text={entry.text} caret={streaming && !entry.replaced} />
          {href ? (
            <p className="mt-3">
              <Link href={href}>{filtersLabel}</Link>
            </p>
          ) : null}
          {(entry.links ?? []).map((link) => {
            const target = safeHref(link.href);
            return target !== undefined && isSiteLinkPath(target) ? (
              <p key={target} className="mt-3">
                <Link href={target} variant="arrow">
                  {link.text}
                </Link>
              </p>
            ) : null;
          })}
          {sourceRow(entry.sources ?? [], sourcesLabel)}
        </>
      ),
    cards:
      entry.references.length > 0 || entry.confirm !== undefined ? (
        <>
          {entry.references.length > 0 ? (
            <AnswerCards
              references={entry.references.slice(0, AI_MAX_CARDS_PER_ANSWER)}
              controls={controls}
            />
          ) : null}
          {entry.seeAll !== undefined && isSeeAllPath(entry.seeAll.href) ? (
            <p className="@xl:col-span-2" data-slot="chat-see-all">
              <Link href={entry.seeAll.href} variant="arrow">
                {entry.seeAll.text}
              </Link>
            </p>
          ) : null}
          {entry.confirm ? (
            <div className="@xl:col-span-2">
              <ChatConfirm card={entry.confirm} focusHeading onKeepMessage={keepMessage} />
            </div>
          ) : null}
        </>
      ) : undefined,
    notes:
      entry.notes.length > 0
        ? entry.notes.map((note) => <ChatNoteLine key={note.key}>{note.text}</ChatNoteLine>)
        : undefined,
  };
}

/**
 * The chat island of `/ai-search` (ADR-128 section 10, P5-T02). It keeps the conversation, sends it to
 * `POST /api/ai/chat`, reads the stream and draws it with the chat parts. It holds no rule of the assistant: the
 * server counts the free messages, checks every word and builds every card link. What it does keep is the
 * transcript and the unsent draft in `sessionStorage`, so a visitor who signs in to keep chatting comes back to the
 * same conversation and presses Send themself (nothing is sent automatically).
 */
export function ChatIsland({
  signedIn,
  controls,
  context = null,
  disclaimer = "",
}: {
  signedIn: boolean;
  /** The super admin's disclaimer for this page (ADR-152): shown under the example questions, gone once chatting starts. */
  disclaimer?: string;
  /** The page the chat was opened from, as the server checked it: public ids only. Sent with each message. */
  context?: ChatContext | null;
  controls: ChatCardControls;
}) {
  const translate = useTranslations("ai");
  const restoredWords = useTranslations("domain.sessionEnded");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [gate, setGate] = useState(false);
  const [gateFocus, setGateFocus] = useState(false);
  const [ready, setReady] = useState(false);
  const [returned, setReturned] = useState(false);
  const [live, setLive] = useState<LiveAnswer | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  // The homes ticked for Compare in this browser (ids only, none while fewer than two), reported by the compare bar.
  const tickedRef = useRef<readonly string[]>([]);
  const reportTicked = useCallback((ids: readonly string[]) => {
    tickedRef.current = ids;
  }, []);
  const abort = useRef<AbortController | null>(null);
  // The requirements state the server signed (ADR-206): sent back with the next message, kept with the conversation.
  const chatState = useRef<string | undefined>(undefined);
  const problemRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const composerId = useId();
  const fieldId = `${COMPOSER_ID}-${composerId.replaceAll(":", "")}`;

  const focusComposer = useCallback(() => {
    document.getElementById(fieldId)?.focus();
  }, [fieldId]);

  // The home page's question, taken from this tab in the restore effect and sent by the effect after `run`. It is
  // held in a ref so React's development double run of effects can neither lose it nor send it twice.
  const homeQuestion = useRef<{ text: string; before: readonly ChatEntry[] } | null>(null);

  // Restore the conversation, the draft and the gate from this tab, once, after the first render (so the page and
  // its first hydration agree). A visitor who was shown the gate and is now signed in has come back from signing in.
  useEffect(() => {
    const storage = browserStorage();
    let stored = loadChat(storage);
    // What was kept while signed in is not shown to whoever uses the tab after the visitor has signed out.
    if (stored.account && !signedIn) {
      stored = EMPTY_CHAT;
      saveChat(storage, EMPTY_CHAT);
    }
    chatState.current = stored.state;
    /* eslint-disable react-hooks/set-state-in-effect -- the browser's storage can only be read after hydration */
    setEntries(stored.entries);
    setDraft(stored.draft);
    if (signedIn && stored.gate) {
      setReturned(true);
      setGate(false);
    } else {
      setGate(stored.gate);
    }
    // The question written on the home page's search bar (ADR-150). While the sign-in gate is up it would only be
    // refused, so it waits in the box; otherwise it is sent once the conversation is back (the effect below).
    const question = takeHomeQuestion(storage);
    if (question !== null) {
      if (question !== "" && stored.gate && !signedIn) setDraft(question);
      else homeQuestion.current = { text: question, before: stored.entries };
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [signedIn]);

  useEffect(() => {
    if (ready && returned) focusComposer();
  }, [ready, returned, focusComposer]);

  // The message of a confirm card the customer left to sign in again comes back into an empty box, as the forms
  // bring back what was typed; nothing is sent until they press Send themself.
  const keptMessage = useRestoredDraft(CONFIRM_DRAFT_NAME);
  useRestoredNotice(CONFIRM_DRAFT_NAME, keptMessage, restoredWords("restored"));
  useEffect(() => {
    const message = keptMessage?.["message"];
    if (!ready || typeof message !== "string") return;
    /* eslint-disable react-hooks/set-state-in-effect -- the kept message can only be read in the browser, after hydration */
    setDraft((current) =>
      current.trim() === "" ? message.slice(0, MAX_INPUT_CHARACTERS) : current,
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [ready, keptMessage]);

  useEffect(() => {
    if (!ready) return;
    saveChat(browserStorage(), {
      version: 1,
      entries,
      draft,
      gate,
      account: signedIn,
      ...(chatState.current === undefined ? {} : { state: chatState.current }),
    });
  }, [ready, entries, draft, gate, signedIn]);

  useEffect(() => () => abort.current?.abort(), []);

  // The watch that scrolls to the newest words once a phone's keyboard has closed (see `keyboard.ts`).
  const keyboardWatch = useRef<(() => void) | null>(null);
  useEffect(() => () => keyboardWatch.current?.(), []);

  // Keep the newest words in view above the composer. The page scrolls (the composer is sticky), so the end of the
  // conversation is brought up to just above the composer, not to the bottom edge where the composer would cover it.
  const scrollToNewest = useCallback((smooth: boolean) => {
    const end = endRef.current;
    const root = rootRef.current;
    if (!end || !root) return;
    const composer = root.querySelector('[data-slot="chat-composer"]');
    const limit = composer ? composer.getBoundingClientRect().top : window.innerHeight;
    const distance = end.getBoundingClientRect().bottom - (limit - NEWEST_BREATHING_ROOM);
    if (distance <= 0) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    document.documentElement.scrollBy?.({
      top: distance,
      behavior: smooth && !reduced ? "smooth" : "auto",
    });
  }, []);

  // A new message (the visitor's or the finished answer) glides into view. The first run only restores a
  // conversation kept in this tab, which is shown in place, and an empty chat never scrolls the page.
  const shownCount = useRef<number | null>(null);
  useEffect(() => {
    if (!ready) return;
    const previous = shownCount.current;
    shownCount.current = entries.length;
    if (entries.length === 0) return;
    scrollToNewest(previous !== null);
  }, [ready, entries.length, scrollToNewest]);

  // While an answer is being written, follow it without a glide (a glide restarted on every word would lag behind).
  useEffect(() => {
    if (live === null) return;
    scrollToNewest(false);
  }, [live, scrollToNewest]);

  // The short wait: the composer is off until it is over, then it works again.
  const waitSeconds = problem?.kind === "too_many_messages" ? problem.seconds : null;
  useEffect(() => {
    if (waitSeconds === null) return;
    const timer = window.setTimeout(() => {
      setProblem(null);
      // The box was switched off, so focus fell out of it; put it back when it works again.
      focusComposer();
    }, waitSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [waitSeconds, focusComposer]);

  useEffect(() => {
    if (problem?.kind === "error") problemRef.current?.focus();
  }, [problem]);

  const busy = live !== null;
  const limited =
    problem?.kind === "too_many_messages" ||
    problem?.kind === "daily_limit" ||
    problem?.kind === "unavailable";

  const run = useCallback(
    async (text: string, before: readonly ChatEntry[], userId: string, more = false) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      const answer: LiveAnswer = {
        ...NO_ANSWER,
        id: newId(),
        notes: [],
        references: [],
        sources: [],
        replies: [],
        seeAll: undefined,
      };
      setLive({ ...answer });
      setProblem(null);

      function refused(failure: Awaited<ReturnType<typeof readChatFailure>>) {
        setLive(null);
        if (failure.state === "error") {
          setProblem({ kind: "error", text, userId });
          return;
        }
        // The message was not answered, so it goes back to the box instead of staying in the conversation.
        setEntries((current) => current.filter((entry) => entry.id !== userId));
        // Keep what the visitor typed while waiting; the refused message comes back only into an empty box.
        setDraft((current) => (current.trim() === "" ? text : current));
        if (failure.state === "sign_in_required") {
          setGate(true);
          setGateFocus(true);
        } else if (failure.state === "too_many_messages") {
          setProblem({ kind: "too_many_messages", seconds: failure.seconds });
        } else {
          setProblem({ kind: failure.state });
        }
      }

      try {
        const response = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            messages: buildHistory(before, text),
            ...contextField(context, tickedRef.current, shownRecords(before)),
            ...(chatState.current === undefined ? {} : { state: chatState.current }),
            // The Show more button asks for the next page of the same search, served without the model (ADR-206).
            ...(more ? { more: true } : {}),
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          refused(await readChatFailure(response));
          return;
        }
        if (response.body === null) throw new Error("The answer has no body");
        let finished = false;
        for await (const event of readChatEvents(response.body)) {
          if (event.type === "status") {
            answer.status = event.text;
          } else if (event.type === "text") {
            answer.text += event.text;
          } else if (event.type === "card") {
            if (answer.references.length < AI_MAX_CARDS_PER_ANSWER) {
              answer.references.push(event.reference);
            }
          } else if (event.type === "link") {
            if (!answer.links.some((link) => link.href === event.href)) {
              answer.links.push({ text: event.text, href: event.href });
            }
          } else if (event.type === "source") {
            if (
              isSourcePath(event.href) &&
              answer.sources.length < AI_MAX_SOURCES_PER_ANSWER &&
              !answer.sources.some((source) => source.href === event.href)
            ) {
              answer.sources.push({ kind: event.kind, title: event.title, href: event.href });
            }
          } else if (event.type === "see_all") {
            if (isSeeAllPath(event.href)) answer.seeAll = { text: event.text, href: event.href };
          } else if (event.type === "state") {
            chatState.current = event.token;
          } else if (event.type === "replies") {
            answer.replies = event.items.slice(0, 3);
          } else if (event.type === "confirm") {
            answer.confirm = event.card;
          } else if (event.type === "notice") {
            if (event.key === MASKED_NOTICE_KEY) {
              setEntries((current) =>
                current.map((entry) =>
                  entry.id === userId && entry.role === "user" ? { ...entry, masked: true } : entry,
                ),
              );
            } else {
              answer.notes.push({ key: event.key, text: event.text });
            }
          } else if (event.type === "replace") {
            answer.text = event.text;
            answer.notes = [];
            answer.references = [];
            answer.links = [];
            answer.sources = [];
            answer.replies = [];
            answer.seeAll = undefined;
            answer.confirm = undefined;
            answer.replaced = true;
            answer.href = event.href;
          } else if (event.type === "done") {
            finished = true;
          }
          setLive({ ...answer });
        }
        // An answer that stopped before `done` is not shown as if it were whole.
        if (!finished) throw new Error("The answer ended early");
        setEntries((current) => [
          ...current,
          {
            id: answer.id,
            role: "assistant",
            text: answer.text,
            notes: answer.notes,
            references: answer.references,
            ...(answer.links.length === 0 ? {} : { links: answer.links }),
            ...(answer.sources.length === 0 ? {} : { sources: answer.sources }),
            ...(answer.replies.length === 0 ? {} : { replies: answer.replies }),
            ...(answer.seeAll === undefined ? {} : { seeAll: answer.seeAll }),
            ...(answer.confirm === undefined ? {} : { confirm: answer.confirm }),
            replaced: answer.replaced,
            ...(answer.href === undefined ? {} : { href: answer.href }),
          },
        ]);
        setLive(null);
      } catch {
        if (controller.signal.aborted) return;
        refused({ state: "error" });
      }
    },
    [context],
  );

  // Send the home page's question as the next message of the conversation in this tab (ADR-150); an empty one only
  // puts the cursor in the box. The short timer is cancelled by the development double run, so it fires once.
  useEffect(() => {
    if (!ready || homeQuestion.current === null) return;
    const timer = window.setTimeout(() => {
      const question = homeQuestion.current;
      homeQuestion.current = null;
      if (question === null) return;
      focusComposer();
      if (question.text === "") return;
      const userId = newId();
      setEntries([
        ...question.before,
        { id: userId, role: "user", text: question.text, masked: false, at: sentAt() },
      ]);
      setReturned(false);
      void run(question.text, question.before, userId);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ready, run, focusComposer]);

  /** Sends a message: the box's own words, or the words of a reply button (which are the same as typing them). */
  function sendText(text: string, keepDraft = false, more = false) {
    if (text === "" || busy || limited || gate) return;
    const userId = newId();
    const before = entries;
    setEntries([...before, { id: userId, role: "user", text, masked: false, at: sentAt() }]);
    if (!keepDraft) setDraft("");
    setReturned(false);
    if (isTouchScreen()) {
      // On a phone the cursor leaves the box, so the keyboard closes by itself (owner, 28 Nov 2026). When the screen
      // has grown back, the newest words are brought into view again. It also covers the reply buttons and Show more,
      // which used to open the keyboard.
      (document.activeElement as HTMLElement | null)?.blur();
      keyboardWatch.current?.();
      keyboardWatch.current = afterKeyboardCloses(() => scrollToNewest(false));
    } else {
      // Pressing the Send button must not leave focus on a button that turns off (handoff section 6).
      focusComposer();
    }
    void run(text, before, userId, more);
  }

  function send() {
    sendText(draft.trim());
  }

  /** The customer is leaving to sign in with a card open: keep its message for the way back (never sent by itself). */
  function keepMessage(message: string) {
    saveDraft(CONFIRM_DRAFT_NAME, window.location.pathname, { message });
    // The chat's own copy of the transcript is written now, because the page is about to be left.
    saveChat(browserStorage(), {
      version: 1,
      entries,
      draft,
      gate,
      account: signedIn,
      ...(chatState.current === undefined ? {} : { state: chatState.current }),
    });
  }

  function retry() {
    if (problem?.kind !== "error" || busy) return;
    const index = entries.findIndex((entry) => entry.id === problem.userId);
    if (index === -1) return;
    void run(problem.text, entries.slice(0, index), problem.userId);
  }

  function pickExample(text: string) {
    setDraft(text.slice(0, MAX_INPUT_CHARACTERS));
    focusComposer();
  }

  // Written out key by key, so every example is a literal key of en.json (the message check finds its use).
  const examples = [
    translate("examples.search"),
    translate("examples.builder"),
    translate("examples.emi"),
    translate("examples.tamil"),
    translate("examples.tanglish"),
  ];
  const hasMessages = entries.length > 0 || live !== null;
  // The reply buttons of the newest answer only, and only while nothing else is going on.
  const newest = entries.at(-1);
  const replies =
    newest?.role === "assistant" && !busy && !gate && !limited ? (newest.replies ?? []) : [];
  const composerOff = gate || limited;
  const offReason = limited
    ? draft === ""
      ? translate("composer.off")
      : translate("composer.offWithDraft")
    : undefined;

  return (
    <div
      ref={rootRef}
      className="mx-auto flex w-full max-w-205 flex-1 flex-col gap-6 px-gutter py-6 md:py-10"
    >
      {ready && hasMessages ? (
        <div className="flex items-center gap-3 border-b border-line pb-4">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-pill bg-cta-tint text-cta-text"
          >
            <Icon icon={Sparkles} />
          </span>
          <Heading as="h1" size="3">
            {translate("assistantName")}
          </Heading>
        </div>
      ) : (
        <div className="grid gap-3">
          <Heading as="h1" size="1">
            {translate("heading")}
          </Heading>
          <Text variant="lead" tone="muted" className="max-w-[60ch]">
            {translate("intro")}
          </Text>
          {ready ? (
            <div className="mt-2 grid gap-3">
              <div>
                <Text variant="overline" tone="muted">
                  {translate("examples.label")}
                </Text>
                <Text variant="small" tone="muted">
                  {translate("examples.help")}
                </Text>
              </div>
              <ul className="flex flex-wrap gap-2">
                {examples.map((example) => (
                  <li key={example}>
                    <Chip
                      type="button"
                      disabled={composerOff}
                      className="h-auto min-h-(--size-chip) py-2 text-left whitespace-normal"
                      onClick={() => pickExample(example)}
                    >
                      {example}
                    </Chip>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {disclaimer !== "" ? (
            <p
              data-slot="ai-search-disclaimer"
              className="mt-2 text-small whitespace-pre-line text-muted"
            >
              {disclaimer}
            </p>
          ) : null}
        </div>
      )}

      {returned ? (
        <Alert tone="success" title={translate("returnedTitle")}>
          {translate("returnedBody")}
        </Alert>
      ) : null}

      {hasMessages ? (
        <ChatThread>
          {[
            ...entries.map((entry) =>
              entry.role === "user" ? (
                <ChatUserBubble
                  key={entry.id}
                  {...(entry.at === undefined ? {} : { time: messageTime(entry.at) })}
                  notice={
                    entry.masked ? (
                      <ChatNoteLine align="user" live>
                        {translate("maskedNotice")}
                      </ChatNoteLine>
                    ) : undefined
                  }
                >
                  {entry.text}
                </ChatUserBubble>
              ) : (
                <Answer
                  key={entry.id}
                  answer={entry}
                  filtersLabel={translate("notice.useFilters")}
                  sourcesLabel={translate("sources.label")}
                  controls={controls}
                  keepMessage={keepMessage}
                />
              ),
            ),
            // The answer in flight has the key it will keep, so its cards (a confirm card among them) stay in place.
            ...(live
              ? [
                  <Answer
                    key={live.id}
                    answer={live}
                    streaming
                    filtersLabel={translate("notice.useFilters")}
                    sourcesLabel={translate("sources.label")}
                    controls={controls}
                    keepMessage={keepMessage}
                  />,
                ]
              : []),
          ]}
        </ChatThread>
      ) : null}

      {replies.length > 0 ? (
        <ul
          aria-label={translate("replies.label")}
          className="flex flex-wrap gap-2"
          data-slot="chat-replies"
        >
          {replies.map((reply) => (
            <li key={reply.key}>
              <Chip
                type="button"
                className="h-auto min-h-(--size-chip) py-2 text-left whitespace-normal"
                onClick={() => sendText(reply.text, true, reply.key === "showMore")}
              >
                {reply.text}
              </Chip>
            </li>
          ))}
        </ul>
      ) : null}

      <div ref={endRef} />

      {/* Takes the free height, so the composer rests at the bottom of the page even while the chat is empty. */}
      <div aria-hidden="true" className="flex-1" />

      {problem?.kind === "error" ? (
        <div ref={problemRef} tabIndex={-1} className="outline-none">
          <ChatNotice kind="error" onRetry={retry} />
        </div>
      ) : null}
      {problem?.kind === "too_many_messages" ? (
        <ChatNotice kind="too_many_messages" seconds={problem.seconds} filtersHref={FILTERS_HREF} />
      ) : null}
      {problem?.kind === "daily_limit" ? (
        <ChatNotice kind="daily_limit" filtersHref={FILTERS_HREF} />
      ) : null}
      {problem?.kind === "unavailable" ? (
        <ChatNotice kind="unavailable" filtersHref={FILTERS_HREF} />
      ) : null}

      {gate ? (
        <ChatGate
          freeMessages={AI_TRIAL_MESSAGES}
          {...(draft === "" ? {} : { draft })}
          signInHref={SIGN_IN_HREF}
          focusHeading={gateFocus}
        />
      ) : (
        <>
          {controls.CompareBar ? <controls.CompareBar onIds={reportTicked} /> : null}
          <ChatComposer
            id={fieldId}
            docked
            value={draft}
            onChange={setDraft}
            onSend={send}
            maxLength={MAX_INPUT_CHARACTERS}
            busy={busy}
            disabled={composerOff || !ready}
            {...(offReason ? { disabledReason: offReason } : {})}
          />
        </>
      )}
    </div>
  );
}

/** One answer of the assistant, finished or still streaming: the same element either way, so nothing in it restarts when it ends. */
function Answer({
  answer,
  streaming = false,
  filtersLabel,
  sourcesLabel,
  controls,
  keepMessage,
}: {
  answer: AssistantEntry | LiveAnswer;
  streaming?: boolean;
  filtersLabel: string;
  sourcesLabel: string;
  controls: ChatCardControls;
  keepMessage: (message: string) => void;
}) {
  const parts = answerParts(answer, filtersLabel, sourcesLabel, streaming, controls, keepMessage);
  const searching = streaming && answer.text === "" && answer.references.length === 0;
  return (
    <ChatAssistantMessage
      {...(streaming ? { streaming: true } : {})}
      {...(searching
        ? {
            status: (
              <ChatStatusLine
                {...("status" in answer && answer.status !== undefined
                  ? { text: answer.status }
                  : {})}
              />
            ),
          }
        : {})}
      {...(parts.cards ? { cards: parts.cards } : {})}
      {...(parts.notes ? { notes: parts.notes } : {})}
    >
      {parts.text}
    </ChatAssistantMessage>
  );
}
