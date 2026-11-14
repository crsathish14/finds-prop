import { connection } from "next/server";
import { postAiChat } from "@/features/ai-chat";

/**
 * `POST /api/ai/chat`, the streaming endpoint of the AI chat (ADR-128, decision D-STREAM). It composes only: the steps
 * and every rule are in `src/features/ai-chat/endpoint/`. With `FLAG_AI_SEARCH` off it answers 404.
 *
 * `maxDuration` must be a plain number here (Next.js reads it from this file). It is a PLACEHOLDER, owner to confirm
 * (gate G-B), and must equal `AI_ROUTE_MAX_DURATION_SECONDS` in `src/config/ai.ts`, which stays above the time limit
 * and the hard stop of one message; a test checks both.
 */
export const maxDuration = 60;

export async function POST(request: Request) {
  await connection();
  return postAiChat(request);
}
