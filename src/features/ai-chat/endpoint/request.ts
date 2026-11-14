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
 * Zod only, no framework imports (the feature schema rule). Keys the top-level object does not know, such as a
 * later `context`, are dropped.
 */

const customerMessage = z.strictObject({
  role: z.literal("user"),
  text: z.string().min(1).max(MAX_INPUT_CHARACTERS),
});

const assistantMessage = z.strictObject({
  role: z.literal("assistant"),
  text: z.string().min(1).max(AI_MAX_HISTORY_ANSWER_CHARACTERS),
});

export const chatRequestSchema = z
  .object({
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
