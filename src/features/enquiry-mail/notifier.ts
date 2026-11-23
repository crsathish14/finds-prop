import type { Notifier } from "@/server/mail";
import { deliverEnquiryMails, failureFields, type EnquiryMailDeps } from "./deliver";
import type { EnquiryMailFinder } from "./types";

/**
 * The notifier for the enquiry events (ADR-188): it finds the facts for an event by its id, then sends the mails.
 * It never throws: whatever goes wrong (the read, the cap, the sender) is logged by its code and ignored, because
 * telling someone about an enquiry is never a reason for the enquiry to fail. It handles `enquiry.received` and
 * `project_lead.received`, as far as the finder it is given knows them; any other event finds nothing and ends.
 */
export function createEnquiryMailNotifier(options: {
  find: EnquiryMailFinder;
  deps: EnquiryMailDeps;
}): Notifier {
  const { find, deps } = options;
  return {
    async notify(event) {
      try {
        const facts = await find(event);
        if (!facts) {
          deps.log.info("enquiry mail skipped: nothing found for the event", { kind: event.kind });
          return;
        }
        await deliverEnquiryMails(facts, deps);
      } catch (error) {
        deps.log.error("enquiry mail failed", { kind: event.kind, ...failureFields(error) });
      }
    },
  };
}
