import { confirmProposalInputSchema, type ConfirmProposalInput } from "./confirm/confirm-card";
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

/**
 * The confirm card's Send button (AI-P6-T02). It needs a signed-in customer with a verified phone, like the two
 * actions it runs (`sendEnquiry`, `submitProjectLead`), whose own limits then apply: it adds no limit of its own,
 * because a refused proposal costs nothing and a real send is counted by the action that makes it. The card's
 * fresh key stops a double click from running the checks twice; the proposal's own id (see `confirm/send.ts`)
 * makes the send happen once however many keys the same proposal is sent with. It writes nothing itself.
 */
export const confirmProposalConfig = {
  name: "confirmChatProposal",
  input: confirmProposalInputSchema,
  auth: "verified-phone" as const,
  idempotencyKey: (input: ConfirmProposalInput) => input.idempotencyKey,
};
