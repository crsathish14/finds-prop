"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  deleteIntegrationConfig,
  saveIntegrationConfig,
  testIntegrationConfig,
} from "./action-config";
import {
  deleteIntegration as removeConnection,
  saveIntegration as saveConnection,
  testIntegration as testConnection,
} from "./integration-service";
import { createCrmAdminStore, createCrmSendStore } from "./service";

/** Makes a connection, or saves changes to one. Answers its id. Secrets are never answered. */
export const saveCrmIntegration = defineAction({
  ...saveIntegrationConfig,
  handler: async ({ input, session, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveConnection(await createCrmAdminStore(), input);
    log.info("crm connection saved", { integrationId: done.integrationId });
    return done;
  },
});

/** Deletes a connection. Forms linked to it stop sending; the delivery history is kept. */
export const deleteCrmIntegration = defineAction({
  ...deleteIntegrationConfig,
  handler: async ({ input, session, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await removeConnection(await createCrmAdminStore(), input);
    log.info("crm connection deleted", { integrationId: done.integrationId });
    return done;
  },
});

/** Sends a test lead to a connection and answers what came back (no secret, no answer text). */
export const testCrmIntegration = defineAction({
  ...testIntegrationConfig,
  handler: async ({ input, session, requestId, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await testConnection(createCrmSendStore(requestId), input, { fetch });
    log.info("crm connection tested", {
      integrationId: input.integrationId,
      ok: done.ok,
      status: done.status,
    });
    return done;
  },
});
