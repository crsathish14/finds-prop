import type { ChatContext } from "../context/page-context";
import { z } from "zod";
import {
  AI_MAX_CARDS_PER_ANSWER,
  AI_MAX_SOURCES_PER_ANSWER,
  AI_MAX_HISTORY_ANSWER_CHARACTERS,
  AI_MAX_HISTORY_MESSAGES,
  MAX_INPUT_CHARACTERS,
} from "@/config/ai";
import { confirmCardSchema } from "../confirm/confirm-card";

/**
 * What the chat island keeps: the conversation, the unsent draft and whether the sign-in gate was shown. The
 * conversation lives in `sessionStorage` (ADR-128 section 10, the ADR-057 idea) so it survives the trip to sign in.
 * It holds the visitor's words and the assistant's checked answer, plus the references of the cards. Never a tool
 * result, a token or an id of the visitor: a confirm card (which holds a signed proposal and the customer's own name
 * and phone) lives in memory only and is left out of what is kept (`forStorage`). Anything read back from storage is checked again, because the browser
 * can hold anything: a value that does not fit is dropped and the chat starts empty.
 */

/** The notice the endpoint sends when it removed personal details from the message (`INPUT_MESSAGE_KEYS.masked`). */
export const MASKED_NOTICE_KEY = "ai.maskedNotice";

const noteSchema = z.object({ key: z.string().max(80), text: z.string().max(400) });

const referenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("home"), homeId: z.string().max(40), slug: z.string().max(200) }),
  z.object({ kind: z.literal("project"), slug: z.string().max(80) }),
]);

/** A page the answer drew on: an article, a question of the FAQ or a job, with the address the server built for it. */
const sourceSchema = z.object({
  kind: z.enum(["article", "faq", "job"]),
  title: z.string().max(200),
  href: z.string().max(200),
});

const userEntrySchema = z.object({
  id: z.string().max(60),
  role: z.literal("user"),
  text: z.string().min(1).max(MAX_INPUT_CHARACTERS),
  masked: z.boolean(),
  /** When the visitor sent it, in milliseconds since 1970 (the browser's clock); older kept chats have none. */
  at: z.number().int().positive().optional(),
});

const assistantEntrySchema = z.object({
  id: z.string().max(60),
  role: z.literal("assistant"),
  text: z.string().max(AI_MAX_HISTORY_ANSWER_CHARACTERS),
  notes: z.array(noteSchema).max(4),
  references: z.array(referenceSchema).max(AI_MAX_CARDS_PER_ANSWER),
  /** Buttons to pages of the site (`site-links.ts`), built by the server from its table. */
  links: z
    .array(z.object({ text: z.string().max(80), href: z.string().max(80) }))
    .max(2)
    .optional(),
  /** The pages a content answer drew on (the "Sources" row), built by the server (`source-links.ts`). */
  sources: z.array(sourceSchema).max(AI_MAX_SOURCES_PER_ANSWER).optional(),
  /** The confirm card of a propose tool, in memory only (never kept in the tab: it holds a signed proposal). */
  confirm: confirmCardSchema.optional(),
  /** The reply buttons the server offered under this answer (ADR-175): fixed wording, shown under the latest answer only. */
  replies: z
    .array(z.object({ key: z.string().max(40), text: z.string().max(80) }))
    .max(3)
    .optional(),
  /** A fixed line replaced the answer; `href` is where the search page is when the line offers it. */
  replaced: z.boolean(),
  href: z.string().max(200).optional(),
});

export const chatEntrySchema = z.discriminatedUnion("role", [
  userEntrySchema,
  assistantEntrySchema,
]);

/** The most turns kept in the tab. Older ones are dropped first; the endpoint only ever sees the last twelve. */
export const MAX_STORED_ENTRIES = 60;

/**
 * The stored value, with the entries still unchecked: each one is checked on its own when it is read back, so one bad
 * entry costs that entry and not the whole conversation.
 */
const storedShellSchema = z.object({
  version: z.literal(1),
  entries: z.array(z.unknown()),
  draft: z.string().max(MAX_INPUT_CHARACTERS),
  gate: z.boolean(),
  /** Whether the visitor was signed in when this was kept: a transcript kept while signed in is not shown to the next visitor of the tab. */
  account: z.boolean(),
});

export type ChatEntry = z.infer<typeof chatEntrySchema>;
export type UserEntry = z.infer<typeof userEntrySchema>;
export type AssistantEntry = z.infer<typeof assistantEntrySchema>;
export type ChatNote = z.infer<typeof noteSchema>;
export type ChatReference = z.infer<typeof referenceSchema>;
export type ChatSource = z.infer<typeof sourceSchema>;
export type StoredChat = {
  version: 1;
  entries: ChatEntry[];
  draft: string;
  gate: boolean;
  account: boolean;
};

export const STORAGE_KEY = "findsprop:ai-chat:v1";

export const EMPTY_CHAT: StoredChat = {
  version: 1,
  entries: [],
  draft: "",
  gate: false,
  account: false,
};

/** The answer as the tab keeps it: the same words, cards and notes, and no confirm card. */
function withoutConfirmCard(entry: AssistantEntry): AssistantEntry {
  return {
    id: entry.id,
    role: "assistant",
    text: entry.text,
    notes: entry.notes,
    references: entry.references,
    ...(entry.links === undefined ? {} : { links: entry.links }),
    ...(entry.sources === undefined ? {} : { sources: entry.sources }),
    ...(entry.replies === undefined ? {} : { replies: entry.replies }),
    replaced: entry.replaced,
    ...(entry.href === undefined ? {} : { href: entry.href }),
  };
}

/**
 * What the tab keeps: the last turns, without a message the server had to remove personal details from (and the
 * answer to it), so a phone number or an email typed by mistake is not left in the browser.
 */
export function forStorage(entries: readonly ChatEntry[]): ChatEntry[] {
  const kept: ChatEntry[] = [];
  let skipping = false;
  for (const entry of entries) {
    if (entry.role === "user") {
      skipping = entry.masked;
      if (!skipping) kept.push(entry);
    } else if (!skipping) {
      // The confirm card stays behind: it holds a signed proposal and the customer's own phone.
      kept.push(withoutConfirmCard(entry));
    }
  }
  return kept.slice(-MAX_STORED_ENTRIES);
}

/** The browser may refuse storage (a private window, blocked site data); the chat then works for this page only. */
export function loadChat(storage: Pick<Storage, "getItem"> | null): StoredChat {
  if (storage === null) return EMPTY_CHAT;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return EMPTY_CHAT;
    const parsed = storedShellSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return EMPTY_CHAT;
    const entries = parsed.data.entries.flatMap((entry) => {
      const checked = chatEntrySchema.safeParse(entry);
      return checked.success ? [checked.data] : [];
    });
    return { ...parsed.data, entries: entries.slice(-MAX_STORED_ENTRIES) };
  } catch {
    return EMPTY_CHAT;
  }
}

export function saveChat(
  storage: Pick<Storage, "setItem" | "removeItem"> | null,
  chat: StoredChat,
): void {
  if (storage === null) return;
  const kept = { ...chat, entries: forStorage(chat.entries) };
  try {
    if (kept.entries.length === 0 && kept.draft === "" && !kept.gate) {
      storage.removeItem(STORAGE_KEY);
    } else {
      storage.setItem(STORAGE_KEY, JSON.stringify(kept));
    }
  } catch {
    // Without storage a visitor who signs in starts a new conversation; nothing else breaks.
  }
}

/** `sessionStorage`, or null when the browser will not give it to this page. */
export function browserStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * What is sent to the endpoint: the last turns as `{ role, text }` and nothing else, ending with the new message.
 * A message of the visitor's that never got an answer (it failed, or hit a limit) is left out, so two visitor
 * messages never follow each other; and the endpoint's own size caps are kept here too.
 */
export function buildHistory(
  entries: readonly ChatEntry[],
  newText: string,
): { role: "user" | "assistant"; text: string }[] {
  const turns: { role: "user" | "assistant"; text: string }[] = [];
  entries.forEach((entry, index) => {
    if (entry.role === "user") {
      if (entries[index + 1]?.role !== "assistant") return;
      turns.push({ role: "user", text: entry.text });
    } else {
      turns.push({
        role: "assistant",
        text: entry.text.slice(0, AI_MAX_HISTORY_ANSWER_CHARACTERS),
      });
    }
  });
  turns.push({ role: "user", text: newText });
  return turns.slice(-AI_MAX_HISTORY_MESSAGES);
}

/**
 * One paragraph of an answer cut into sentences, each marked as a question or not, with the spaces between them kept
 * as pieces of their own, so the pieces put back together are the paragraph exactly (ADR-184). A sentence ends at
 * `.`, `!` or `?` (or a run of them) that is followed by a space or the end, so a price such as 1.29 Cr or a
 * figure such as 1,420 does not end one. A question is a sentence that ends with `?`; the page draws it in bold, so
 * the customer sees at once what the assistant is asking. The model is not asked to write any mark-up for this.
 */
export function sentenceParts(paragraph: string): { text: string; question: boolean }[] {
  const parts: { text: string; question: boolean }[] = [];
  let start = 0;
  let index = 0;
  const push = (end: number) => {
    if (end <= start) return;
    const text = paragraph.slice(start, end);
    const blank = text.trim() === "";
    parts.push({ text, question: !blank && text.trimEnd().endsWith("?") });
    start = end;
  };
  while (index < paragraph.length) {
    const character = paragraph.charAt(index);
    if (character === "." || character === "!" || character === "?") {
      let end = index + 1;
      while (end < paragraph.length && ".!?".includes(paragraph.charAt(end))) end += 1;
      const next = paragraph.charAt(end);
      if (end >= paragraph.length || /\s/u.test(next)) {
        push(end);
        // The spaces after the sentence are a piece of their own.
        let spaceEnd = end;
        while (spaceEnd < paragraph.length && /\s/u.test(paragraph.charAt(spaceEnd))) spaceEnd += 1;
        push(spaceEnd);
      }
      index = Math.max(end, index + 1);
    } else {
      index += 1;
    }
  }
  push(paragraph.length);
  return parts;
}

/**
 * The time a message was sent, written for reading and shown beside the visitor's message (ADR-185): "7:49 pm" for
 * today, "23 Nov, 7:49 pm" for another day. It uses the visitor's own clock and zone. The answer itself never
 * carries a time.
 */
export function messageTime(
  at: number,
  now: number = Date.now(),
): { label: string; dateTime: string } {
  const sent = new Date(at);
  const clock = new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(sent);
  const today = new Date(now);
  const sameDay =
    sent.getFullYear() === today.getFullYear() &&
    sent.getMonth() === today.getMonth() &&
    sent.getDate() === today.getDate();
  const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(sent);
  return { label: sameDay ? clock : `${day}, ${clock}`, dateTime: sent.toISOString() };
}

/** A link the server offered is drawn only if it is a path on this site. */
export function safeHref(href: string | undefined): string | undefined {
  if (href === undefined) return undefined;
  // Browsers drop tabs and line breaks inside an address, so a control character could turn "/" + tab + "/host"
  // into "//host": any control character or backslash refuses the link.
  const unsafe = [...href].some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code <= 0x1f || code === 0x7f || character === "\\";
  });
  return href.startsWith("/") && !href.startsWith("//") && !unsafe ? href : undefined;
}

/**
 * The context sent with a message: the page's own (a home, a project, a link from the Compare page) with the ticked
 * homes as `compare` when two or more are ticked. Ids only; the server checks each one again.
 */
export function contextField(
  page: ChatContext | null,
  ticked: readonly string[],
  shown: { homes: readonly string[]; projects: readonly string[] } = { homes: [], projects: [] },
): { context?: ChatContext } {
  // The compare bar reports nothing unless two or three homes are ticked, so one tick sends no compare context.
  const context: ChatContext = {
    ...page,
    ...(ticked.length === 0 ? {} : { compare: ticked.slice(0, 3) }),
    ...(shown.homes.length === 0
      ? {}
      : { shownHomes: shown.homes.slice(0, AI_MAX_CARDS_PER_ANSWER) }),
    ...(shown.projects.length === 0
      ? {}
      : { shownProjects: shown.projects.slice(0, AI_MAX_CARDS_PER_ANSWER) }),
  };
  return Object.keys(context).length === 0 ? {} : { context };
}

/**
 * The homes and projects the newest answer showed, as ids and slugs, so the next message can say "the second one" or
 * "compare these" and the assistant knows which (ADR-180). Only an answer that was not replaced counts.
 */
export function shownRecords(entries: readonly ChatEntry[]): {
  homes: string[];
  projects: string[];
} {
  const last = entries.at(-1);
  const shown = { homes: [] as string[], projects: [] as string[] };
  if (last?.role !== "assistant" || last.replaced) return shown;
  for (const reference of last.references) {
    if (reference.kind === "home") shown.homes.push(reference.homeId);
    else shown.projects.push(reference.slug);
  }
  return shown;
}
