"use server";

import { defineAction } from "@/server/actions/define-action";
import { readChatCardsConfig } from "./action-config";
import { readChatCards } from "./chat-cards";

/** The card facts for the home and project references of one answer (a read; nothing is written). */
export const readChatCardsAction = defineAction({
  ...readChatCardsConfig,
  handler: async ({ input }) => readChatCards(input.references),
});
