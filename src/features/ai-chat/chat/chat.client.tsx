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
import { Text } from "@/components/ui/text";
import { AI_MAX_CARDS_PER_ANSWER, AI_TRIAL_MESSAGES, MAX_INPUT_CHARACTERS } from "@/config/ai";
import { AnswerCards, type ChatCardControls } from "./answer-cards.client";
import {
  browserStorage,
  buildHistory,
  loadChat,
  MASKED_NOTICE_KEY,
  safeHref,
  saveChat,
  type AssistantEntry,
  type ChatEntry,
  type ChatNote,
  type ChatReference,
} from "./chat-model";
import { readChatEvents, readChatFailure } from "./chat-stream";

/** Where the sign-in gate leads: the phone sign-in, asked to come back to this page (ADR-128 section 10). */
const SIGN_IN_HREF = "/auth?redirect=%2Fai-search";

/** The normal search, offered by the limit notices and the fixed fallback. */
const FILTERS_HREF = "/properties";

const COMPOSER_ID = "ai-chat-message";

/** What the assistant has written so far for the message in flight. */
type LiveAnswer = {
  text: string;
  notes: ChatNote[];
  references: ChatReference[];
  replaced: boolean;
  href: string | undefined;
};

/** What went wrong with the last message, so the notice and the composer can say it. */
type Problem =
  | { kind: "error"; text: string; userId: string }
  | { kind: "too_many_messages"; seconds: number }
  | { kind: "daily_limit" }
  | { kind: "unavailable" };

const NO_ANSWER: LiveAnswer = {
  text: "",
  notes: [],
  references: [],
  replaced: false,
  href: undefined,
};

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
          {paragraph.trim()}
          {caret && index === parts.length - 1 ? <ChatStreamCaret /> : null}
        </p>
      ))}
    </>
  );
}

/** The text, the cards and the notes of one answer, as the parts of a `ChatAssistantMessage`. */
function answerParts(
  entry: Pick<AssistantEntry, "text" | "notes" | "references" | "replaced" | "href">,
  filtersLabel: string,
  streaming: boolean,
  controls: ChatCardControls,
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
        </>
      ),
    cards:
      entry.references.length > 0 ? (
        <AnswerCards
          references={entry.references.slice(0, AI_MAX_CARDS_PER_ANSWER)}
          controls={controls}
        />
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
}: {
  signedIn: boolean;
  controls: ChatCardControls;
}) {
  const translate = useTranslations("ai");
  const [entries, setEntries] = useState<ChatEntry[]>([]);
  const [draft, setDraft] = useState("");
  const [gate, setGate] = useState(false);
  const [gateFocus, setGateFocus] = useState(false);
  const [ready, setReady] = useState(false);
  const [returned, setReturned] = useState(false);
  const [live, setLive] = useState<LiveAnswer | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const abort = useRef<AbortController | null>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const composerId = useId();
  const fieldId = `${COMPOSER_ID}-${composerId.replaceAll(":", "")}`;

  const focusComposer = useCallback(() => {
    document.getElementById(fieldId)?.focus();
  }, [fieldId]);

  // Restore the conversation, the draft and the gate from this tab, once, after the first render (so the page and
  // its first hydration agree). A visitor who was shown the gate and is now signed in has come back from signing in.
  useEffect(() => {
    const stored = loadChat(browserStorage());
    /* eslint-disable react-hooks/set-state-in-effect -- the browser's storage can only be read after hydration */
    setEntries(stored.entries);
    setDraft(stored.draft);
    if (signedIn && stored.gate) {
      setReturned(true);
      setGate(false);
    } else {
      setGate(stored.gate);
    }
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [signedIn]);

  useEffect(() => {
    if (ready && returned) focusComposer();
  }, [ready, returned, focusComposer]);

  useEffect(() => {
    if (!ready) return;
    saveChat(browserStorage(), { version: 1, entries, draft, gate });
  }, [ready, entries, draft, gate]);

  useEffect(() => () => abort.current?.abort(), []);

  // Keep the newest words in view above the composer.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [entries.length, live?.text, live?.references.length]);

  // The short wait: the composer is off until it is over, then it works again.
  const waitSeconds = problem?.kind === "too_many_messages" ? problem.seconds : null;
  useEffect(() => {
    if (waitSeconds === null) return;
    const timer = window.setTimeout(() => setProblem(null), waitSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [waitSeconds]);

  useEffect(() => {
    if (problem?.kind === "error") problemRef.current?.focus();
  }, [problem]);

  const busy = live !== null;
  const limited =
    problem?.kind === "too_many_messages" ||
    problem?.kind === "daily_limit" ||
    problem?.kind === "unavailable";

  const run = useCallback(async (text: string, before: readonly ChatEntry[], userId: string) => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const answer: LiveAnswer = { ...NO_ANSWER, notes: [], references: [] };
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
      setDraft(text);
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
        body: JSON.stringify({ messages: buildHistory(before, text) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        refused(await readChatFailure(response));
        return;
      }
      if (response.body === null) throw new Error("The answer has no body");
      let finished = false;
      for await (const event of readChatEvents(response.body)) {
        if (event.type === "text") {
          answer.text += event.text;
        } else if (event.type === "card") {
          if (answer.references.length < AI_MAX_CARDS_PER_ANSWER) {
            answer.references.push(event.reference);
          }
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
          id: newId(),
          role: "assistant",
          text: answer.text,
          notes: answer.notes,
          references: answer.references,
          replaced: answer.replaced,
          ...(answer.href === undefined ? {} : { href: answer.href }),
        },
      ]);
      setLive(null);
    } catch {
      if (controller.signal.aborted) return;
      refused({ state: "error" });
    }
  }, []);

  function send() {
    const text = draft.trim();
    if (text === "" || busy || limited || gate) return;
    const userId = newId();
    const before = entries;
    setEntries([...before, { id: userId, role: "user", text, masked: false }]);
    setDraft("");
    setReturned(false);
    // Pressing the Send button must not leave focus on a button that turns off (handoff section 6).
    focusComposer();
    void run(text, before, userId);
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
  const composerOff = gate || limited;
  const offReason = limited
    ? draft === ""
      ? translate("composer.off")
      : translate("composer.offWithDraft")
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-205 flex-1 flex-col gap-6 px-gutter py-6 md:py-10">
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
        </div>
      )}

      {returned ? (
        <Alert tone="success" title={translate("returnedTitle")}>
          {translate("returnedBody")}
        </Alert>
      ) : null}

      {hasMessages ? (
        <ChatThread>
          {entries.map((entry) =>
            entry.role === "user" ? (
              <ChatUserBubble
                key={entry.id}
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
              <SavedAnswer
                key={entry.id}
                entry={entry}
                filtersLabel={translate("notice.useFilters")}
                controls={controls}
              />
            ),
          )}
          {live ? (
            <LiveAnswerItem
              live={live}
              filtersLabel={translate("notice.useFilters")}
              controls={controls}
            />
          ) : null}
        </ChatThread>
      ) : null}

      <div ref={endRef} />

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
      )}
    </div>
  );
}

function SavedAnswer({
  entry,
  filtersLabel,
  controls,
}: {
  entry: AssistantEntry;
  filtersLabel: string;
  controls: ChatCardControls;
}) {
  const parts = answerParts(entry, filtersLabel, false, controls);
  return (
    <ChatAssistantMessage
      {...(parts.cards ? { cards: parts.cards } : {})}
      {...(parts.notes ? { notes: parts.notes } : {})}
    >
      {parts.text}
    </ChatAssistantMessage>
  );
}

function LiveAnswerItem({
  live,
  filtersLabel,
  controls,
}: {
  live: LiveAnswer;
  filtersLabel: string;
  controls: ChatCardControls;
}) {
  const parts = answerParts(live, filtersLabel, true, controls);
  const searching = live.text === "" && live.references.length === 0;
  return (
    <ChatAssistantMessage
      streaming
      {...(searching ? { status: <ChatStatusLine /> } : {})}
      {...(parts.cards ? { cards: parts.cards } : {})}
      {...(parts.notes ? { notes: parts.notes } : {})}
    >
      {parts.text}
    </ChatAssistantMessage>
  );
}
