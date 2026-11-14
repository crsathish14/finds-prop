import "server-only";
import { handleAiChat } from "./handler";

/**
 * What the route calls: the real dependencies are loaded when a request arrives, not when this module is imported,
 * so importing the feature (the tool tests do) does not pull in the session, the flags and the rate-limit client.
 */
export async function postAiChat(request: Request): Promise<Response> {
  const { createChatDeps } = await import("./deps");
  return handleAiChat(request, createChatDeps());
}
