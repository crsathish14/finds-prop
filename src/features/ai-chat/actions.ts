"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import { confirmProposalConfig, readChatCardsConfig } from "./action-config";
import { readChatCards } from "./chat-cards";
import { realSendDeps, sendConfirmedProposal } from "./confirm/send";

/** The card facts for the home and project references of one answer (a read; nothing is written). */
export const readChatCardsAction = defineAction({
  ...readChatCardsConfig,
  handler: async ({ input }) => readChatCards(input.references),
});

/**
 * The confirm card's Send button: checks the signed proposal for the signed-in customer and runs the existing
 * `sendEnquiry` or `submitProjectLead` (AI-P6-T02). It answers only that the request was received.
 */
export const confirmChatProposal = defineAction({
  ...confirmProposalConfig,
  handler: async ({ input, session }) => {
    // defineAction has already refused a visitor with no verified phone; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    return sendConfirmedProposal(
      { proposal: input.proposal, userId: session.userId },
      realSendDeps,
    );
  },
});
