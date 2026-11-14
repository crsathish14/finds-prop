import { z } from "zod";
import { AI_MAX_CARDS_PER_ANSWER } from "@/config/ai";
import { isShortId } from "@/lib/short-id";

/**
 * A card the chat is asked to draw: only the reference the endpoint streamed (a home's public id and slug, or a
 * project's slug). The answer is never trusted for anything else; the card's facts are read from the public pages'
 * own reads. One schema for the page and the action (R-FE-10).
 */
const PROJECT_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const chatCardReferenceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("home"),
    homeId: z.string().refine(isShortId, "validation.invalid"),
    slug: z.string().min(1).max(200),
  }),
  z.object({
    kind: z.literal("project"),
    slug: z.string().min(2).max(80).regex(PROJECT_SLUG, "validation.invalid"),
  }),
]);

export const readChatCardsInputSchema = z.object({
  references: z.array(chatCardReferenceSchema).max(AI_MAX_CARDS_PER_ANSWER),
});

export type ChatCardReference = z.infer<typeof chatCardReferenceSchema>;
export type ReadChatCardsInput = z.infer<typeof readChatCardsInputSchema>;
