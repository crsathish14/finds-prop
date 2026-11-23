import "server-only";
import { logger } from "@/server/logger";
import type { NotificationEvent } from "@/server/mail";
import { createEnquiryMailDeps } from "./deps";
import { failureFields } from "./deliver";
import { createEnquiryMailNotifier } from "./notifier";
import type { EnquiryMailFinder } from "./types";

/**
 * Hands one event to the enquiry mail (ADR-188). It is what an enquiry action puts inside `after()`, so the visitor
 * has already been answered and never waits for the mail provider. The event holds an id only; `find` is the
 * feature's own read of that enquiry (its service file holds the service-role client). Never throws.
 */
export async function notifyEnquiryMail(
  event: NotificationEvent,
  find: EnquiryMailFinder,
  requestId: string,
): Promise<void> {
  try {
    await createEnquiryMailNotifier({ find, deps: createEnquiryMailDeps(requestId) }).notify(event);
  } catch (error) {
    logger.error("enquiry mail could not start", {
      requestId,
      route: "enquiry-mail",
      kind: event.kind,
      ...failureFields(error),
    });
  }
}
