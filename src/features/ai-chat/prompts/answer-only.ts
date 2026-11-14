import { ASSISTANT_BRAND_NAME } from "@/config/ai";

/**
 * Added to the system prompt for the answer-only round (ADR-128 section 4.5): tools are off, so the model must
 * answer from the results it already holds and say what it could not check. It is addressed to the model and
 * never shown to a customer. It holds no secret and says nothing about how the site is built.
 */
export const ANSWER_ONLY_INSTRUCTION =
  `You can no longer look anything up for this message. Answer now as the ${ASSISTANT_BRAND_NAME} assistant, ` +
  "using only the tool results above. Say plainly which parts you could not check, " +
  "and do not guess any figure, name or detail that is not in those results.";
