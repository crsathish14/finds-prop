import { ActionError } from "@/server/actions/normalise-error";

/** What the rules need of the database: the agent's phone for the signed-in caller (the function checks the caller itself). */
export interface AgentContactStore {
  readPhone(agentId: string): Promise<{ phone: string | null; errorCode?: string | undefined }>;
}

/**
 * Shows an agent's phone to the caller. The database function refuses a caller without a verified phone (42501) and
 * answers nothing for an id that is no active agent; both end here as the closed error codes, never as text. A number the
 * agent never gave is "not found", so the button can say there is none to show.
 */
export async function revealContact(
  store: AgentContactStore,
  agentId: string,
): Promise<{ phone: string }> {
  const { phone, errorCode } = await store.readPhone(agentId);
  if (errorCode === "42501") throw new ActionError("FORBIDDEN", "A verified phone is required.");
  if (errorCode) throw new ActionError("INTERNAL", "The agent's contact could not be read.");
  if (!phone) throw new ActionError("NOT_FOUND", "The agent has no number to show.");
  return { phone };
}
