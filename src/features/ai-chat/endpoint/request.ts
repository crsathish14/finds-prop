import { z } from "zod";
import {
  AI_MAX_HISTORY_ANSWER_CHARACTERS,
  AI_MAX_HISTORY_MESSAGES,
  MAX_INPUT_CHARACTERS,
} from "@/config/ai";

/**
 * What the browser may send to `POST /api/ai/chat` (ADR-128 section 6.1): the last user and assistant text turns,
 * ending with the customer's new message. Nothing else is accepted from the client: a message is `{ role, text }`
 * with exactly those two fields, so a tool call, a tool result, a system message or any extra field is refused
 * instead of being passed on to the model. The server alone makes tool calls and tool results.
 *
 * Zod only, no framework imports (the feature schema rule). Keys the top-level object does not know are dropped.
 * `context` (AI-P7-T01) is one extra key: public ids of the page the chat was opened from, never listing data.
 * `state` and `more` (ADR-206) are the other two: the requirements state the server signed for this chat, sent back as
 * it came (checked by its signature, ignored when it does not verify), and `more: true` when the customer pressed the
 * Show more button (the next page is then served from the state, without the model, when the state allows it).
 */

const customerMessage = z.strictObject({
  role: z.literal("user"),
  text: z.string().min(1).max(MAX_INPUT_CHARACTERS),
});

const assistantMessage = z.strictObject({
  role: z.literal("assistant"),
  // May be empty: a turn that was only cards or a fixed line is stored by the page as an empty answer.
  text: z.string().max(AI_MAX_HISTORY_ANSWER_CHARACTERS),
});

export const chatRequestSchema = z
  .object({
    // The page the chat was opened from: ids only, and not checked here. The handler checks every id against what is
    // listed now and drops what does not fit (`context/resolve.ts`); a wrong shape is no context, never a refusal.
    context: z.unknown().optional(),
    // Not checked here: `state/chat-state.ts` checks the size and the signature, and a token that fails is no state.
    state: z.unknown().optional(),
    // Anything but true is no Show more press: the message is then answered as any other.
    more: z.unknown().optional(),
    messages: z
      .array(z.discriminatedUnion("role", [customerMessage, assistantMessage]))
      .min(1)
      .max(AI_MAX_HISTORY_MESSAGES),
  })
  .refine((request) => request.messages.at(-1)?.role === "user", {
    path: ["messages"],
    message: "The last message must be the customer's",
  });

export type ChatRequest = z.infer<typeof chatRequestSchema>;
export type ChatRequestMessage = ChatRequest["messages"][number];
