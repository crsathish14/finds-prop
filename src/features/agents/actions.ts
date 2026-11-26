"use server";

import { defineAction } from "@/server/actions/define-action";
import { revealContactConfig } from "./action-config";
import { revealContact } from "./contact-service";
import { createAgentContactStore } from "./contact-store";

/**
 * Shows an agent's phone to a signed-in visitor with a verified phone. The number is returned to that one caller and
 * never placed in a page; the log records the agent's id, not the number.
 */
export const revealAgentContact = defineAction({
  ...revealContactConfig,
  handler: async ({ input, log }) => {
    const { phone } = await revealContact(createAgentContactStore(), input.agentId);
    log.info("agent contact shown", { agentId: input.agentId });
    return { phone };
  },
});
