import "server-only";
import { logger } from "@/server/logger";
import { runDeliveries, syncRetryJob } from "./delivery";
import { createDeliveryStore } from "./service";

/**
 * Sends a submission that has just been stored, right away (S7-T09 part B2). Called from the form actions inside
 * `after()`, so the visitor has already been answered and never waits for somebody else's server. It never throws: a
 * form to a form without a CRM connection finds nothing to claim and ends; a failure is recorded and a retry
 * scheduled by the engine. If the attempt cannot even be made or recorded, the retry job is armed so the sweep takes
 * the submission within a few minutes.
 */
export async function deliverSubmissionNow(submissionId: string, requestId: string): Promise<void> {
  const log = logger.child({ requestId, route: "crm-delivery" });
  try {
    const store = createDeliveryStore(requestId);
    const summary = await runDeliveries(store, { limit: 1, submissionId }, { fetch, log });
    await syncRetryJob(store, summary, log, "other");
  } catch (error) {
    log.error("immediate crm delivery failed", { submissionId, error });
    try {
      await createDeliveryStore(requestId).armRetryJob();
    } catch (armError) {
      log.warn("the crm retry job could not be armed", { error: armError });
    }
  }
}
