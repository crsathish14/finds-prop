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

export const storedChatSchema = z.object({
  version: z.literal(1),
  entries: z.array(chatEntrySchema).max(60),
  draft: z.string().max(MAX_INPUT_CHARACTERS),
  gate: z.boolean(),
});

export type ChatEntry = z.infer<typeof chatEntrySchema>;
export type UserEntry = z.infer<typeof userEntrySchema>;
export type AssistantEntry = z.infer<typeof assistantEntrySchema>;
export type ChatNote = z.infer<typeof noteSchema>;
export type ChatReference = z.infer<typeof referenceSchema>;
export type StoredChat = z.infer<typeof storedChatSchema>;

export const STORAGE_KEY = "findsprop:ai-chat:v1";

export const EMPTY_CHAT: StoredChat = { version: 1, entries: [], draft: "", gate: false };

/** The browser may refuse storage (a private window, blocked site data); the chat then works for this page only. */
export function loadChat(storage: Pick<Storage, "getItem"> | null): StoredChat {
  if (storage === null) return EMPTY_CHAT;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return EMPTY_CHAT;
    const parsed = storedChatSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_CHAT;
  } catch {
    return EMPTY_CHAT;
  }
}

export function saveChat(
  storage: Pick<Storage, "setItem" | "removeItem"> | null,
  chat: StoredChat,
): void {
  if (storage === null) return;
  try {
    if (chat.entries.length === 0 && chat.draft === "" && !chat.gate) {
      storage.removeItem(STORAGE_KEY);
    } else {
      storage.setItem(STORAGE_KEY, JSON.stringify(chat));
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
  return href.startsWith("/") && !href.startsWith("//") && !href.includes("\\") ? href : undefined;
}
