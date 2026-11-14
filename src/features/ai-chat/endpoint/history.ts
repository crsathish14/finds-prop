import type { AiMessage } from "@/server/ai";
import { checkInput, type InputCheckResult } from "../guards/input";
import type { ChatRequestMessage } from "./request";

/**
 * The conversation the model is given, built from what the browser sent (ADR-128 section 6.1). The browser's
 * transcript holds the customer's words as typed, so every earlier customer message goes through the same input
 * check as the new one: personal details are masked again, and an earlier message that the check would refuse
 * (an attack, another portal, flooding) is left out, so it cannot steer the model on a later turn. An earlier
 * assistant turn is text the model may or may not have written, since the browser can send anything: it goes back
 * as plain assistant text, with invisible characters removed, and carries no tool call and no authority.
 */

export interface PreparedConversation {
  /** The check of the customer's new message, the last one sent. */
  readonly latest: InputCheckResult;
  /** The earlier turns that may be given to the model, oldest first, without the new message. */
  readonly history: readonly AiMessage[];
}

const INVISIBLE = /[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/gu;

function plainText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(INVISIBLE, (character) => {
      const code = character.codePointAt(0) ?? 0;
      return code === 0x0a || code === 0x200c || code === 0x200d ? character : " ";
    })
    .trim();
}

export function prepareConversation(messages: readonly ChatRequestMessage[]): PreparedConversation {
  const newest = messages.at(-1);
  const earlier = messages.slice(0, -1);
  const earlierCustomerTexts: string[] = [];
  const history: AiMessage[] = [];

  for (const message of earlier) {
    if (message.role === "assistant") {
      const text = plainText(message.text);
      if (text !== "") history.push({ role: "assistant", text, toolCalls: [] });
      continue;
    }
    const checked = checkInput(message.text, earlierCustomerTexts);
    earlierCustomerTexts.push(message.text);
    if (checked.action !== "refuse") history.push({ role: "user", text: checked.text });
  }

  return { latest: checkInput(newest?.text ?? "", earlierCustomerTexts), history };
}
