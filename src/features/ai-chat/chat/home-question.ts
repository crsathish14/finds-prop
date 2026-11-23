import { MAX_INPUT_CHARACTERS } from "@/config/ai";

/**
 * The question written in the home page's search bar, handed to the chat (owner's change of 22 Nov 2026, ADR-150).
 * It goes through this tab's `sessionStorage`, not the address: the words stay out of server logs and analytics, and
 * a link from another site cannot send a message in the visitor's name. The chat takes it once and removes it, so a
 * refresh does not send it again. An empty question means "open the chat with the cursor in the box".
 */
export const HOME_QUESTION_KEY = "findsprop:ai-chat:home-question:v1";

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

/** Keep the visitor's words for the chat, cut to what the chat accepts. A storage that refuses is ignored. */
export function keepHomeQuestion(storage: Storage | null, text: string): void {
  if (!storage) return;
  try {
    storage.setItem(
      HOME_QUESTION_KEY,
      JSON.stringify({ text: text.trim().slice(0, MAX_INPUT_CHARACTERS) }),
    );
  } catch {
    // Storage full or blocked: the chat simply opens empty.
  }
}

/** The kept question (once: it is removed as it is read), or null when there is none or it is not ours. */
export function takeHomeQuestion(storage: Storage | null): string | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(HOME_QUESTION_KEY);
    if (raw === null) return null;
    storage.removeItem(HOME_QUESTION_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as { text?: unknown }).text !== "string"
    ) {
      return null;
    }
    return (parsed as { text: string }).text.trim().slice(0, MAX_INPUT_CHARACTERS);
  } catch {
    return null;
  }
}
