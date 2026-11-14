import { z } from "zod";
import {
  AI_MAX_CARDS_PER_ANSWER,
  AI_MAX_HISTORY_ANSWER_CHARACTERS,
  AI_MAX_HISTORY_MESSAGES,
  MAX_INPUT_CHARACTERS,
} from "@/config/ai";

/**
 * What the chat island keeps: the conversation, the unsent draft and whether the sign-in gate was shown. The
 * conversation lives in `sessionStorage` (ADR-128 section 10, the ADR-057 idea) so it survives the trip to sign in.
 * It holds the visitor's words and the assistant's checked answer, plus the references of the cards. Never a tool
 * result, a token or an id of the visitor. Anything read back from storage is checked again, because the browser
 * can hold anything: a value that does not fit is dropped and the chat starts empty.
 */

/** The notice the endpoint sends when it removed personal details from the message (`INPUT_MESSAGE_KEYS.masked`). */
export const MASKED_NOTICE_KEY = "ai.maskedNotice";

const noteSchema = z.object({ key: z.string().max(80), text: z.string().max(400) });

const referenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("home"), homeId: z.string().max(40), slug: z.string().max(200) }),
  z.object({ kind: z.literal("project"), slug: z.string().max(80) }),
]);

const userEntrySchema = z.object({
  id: z.string().max(60),
  role: z.literal("user"),
  text: z.string().min(1).max(MAX_INPUT_CHARACTERS),
  masked: z.boolean(),
});

const assistantEntrySchema = z.object({
  id: z.string().max(60),
  role: z.literal("assistant"),
  text: z.string().max(AI_MAX_HISTORY_ANSWER_CHARACTERS),
  notes: z.array(noteSchema).max(4),
  references: z.array(referenceSchema).max(AI_MAX_CARDS_PER_ANSWER),
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
      kept.push(entry);
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
