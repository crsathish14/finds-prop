"use server";

import { defineAction } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import {
  deleteIntegrationConfig,
  retryDeliveryConfig,
  saveIntegrationConfig,
  testIntegrationConfig,
} from "./action-config";
import { armRetryJobQuietly, retryDelivery, syncRetryJob } from "./delivery";
import {
  deleteIntegration as removeConnection,
  saveIntegration as saveConnection,
  testIntegration as testConnection,
} from "./integration-service";
import { createCrmAdminStore, createCrmSendStore, createDeliveryStore } from "./service";

/** Makes a connection, or saves changes to one. Answers its id. Secrets are never answered. */
export const saveCrmIntegration = defineAction({
  ...saveIntegrationConfig,
  handler: async ({ input, session, requestId, log }) => {
    // defineAction has already refused anyone who is not a super admin; this keeps the type honest.
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const done = await saveConnection(await createCrmAdminStore(), input);
    log.info("crm connection saved", { integrationId: done.integrationId });
    // A connection switched on may have submissions waiting (they wait while it is off): the job takes them within a
    // minute and turns itself off again once nothing waits.
    if (input.active) await armRetryJobQuietly(createDeliveryStore(requestId), log);
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

/**
 * "Retry delivery now": sends one form submission to its CRM at once, on a fresh schedule, and answers how it went
 * (the CRM's status, or none when there was no answer). A submission that is already sent, being sent, on an inactive
 * connection or gone is a conflict. A failure leaves the next try scheduled and the retry job armed.
 */
export const retryCrmDelivery = defineAction({
  ...retryDeliveryConfig,
  handler: async ({ input, session, requestId, log }) => {
    if (!session) throw new ActionError("UNAUTHENTICATED", "Signing in is required.");
    const store = createDeliveryStore(requestId);
    const { summary, outcome } = await retryDelivery(store, input, { fetch, log });
    await syncRetryJob(store, summary, log, "other");
    log.info("crm delivery retried", { submissionId: input.submissionId, ok: outcome.ok });
    return { submissionId: input.submissionId, ok: outcome.ok, status: outcome.status };
  },
});
