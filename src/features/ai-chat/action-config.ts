import { readChatCardsInputSchema } from "./schemas";

/**
 * How the card read runs, kept apart from the "use server" file so a test can build it. It only reads the public
 * pages' own cached reads for at most three references, so it needs no account and no limit of its own (the answer
 * that named the references already counted against the chat's limits).
 */
export const readChatCardsConfig = {
  name: "readChatCards",
  input: readChatCardsInputSchema,
  auth: "none" as const,
};
