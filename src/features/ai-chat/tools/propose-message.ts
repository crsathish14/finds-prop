import { z } from "zod";
import { PROPOSAL_MESSAGE_MAX_CHARACTERS } from "@/config/ai";
import { ToolRefusal } from "./types";
import { cleanThirdPartyText } from "./untrusted";

/**
 * The message of a proposal, shared by both propose tools: what the customer will send, written by the model
 * from what the customer asked for. The tool cleans it and checks its length, because a card must never show
 * (or send) text the form would refuse; it never turns the model's words into more than they are.
 */

export const proposalMessageSchema = z
  .string()
  .refine(
    (text) => text.trim() !== "" && Array.from(text).length <= PROPOSAL_MESSAGE_MAX_CHARACTERS,
  )
  .describe(
    `What to send, in the customer's own voice and from what they asked for, at most ${PROPOSAL_MESSAGE_MAX_CHARACTERS} characters. Never a phone number or an email address.`,
  );

/**
 * The message as it is signed and shown: invisible characters removed, the ends trimmed. A message that has
 * nothing left, or would have to be cut, is refused as a bad `message` so the model can write it again; it is
 * never cut silently.
 */
export function cleanedMessage(message: string): string {
  const { text, shortened } = cleanThirdPartyText(message, PROPOSAL_MESSAGE_MAX_CHARACTERS);
  if (text === "" || shortened) throw new ToolRefusal("invalid_input", ["message"]);
  return text;
}
