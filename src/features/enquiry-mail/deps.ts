import "server-only";
import messages from "@/i18n/messages/en.json";
import { publicEnv } from "@/lib/public-env";
import { getMailTemplates } from "@/features/mail-templates";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { chooseMailSender } from "@/server/mail";
import { hitKeyedRateLimit } from "@/server/rate-limit/rate-limit";
import type { EnquiryMailDeps } from "./deliver";

/**
 * The real parts of the enquiry mail (ADR-188): the sender for this environment (ADR-181: nothing without a key,
 * only the test list on dev and staging), the published wording, the poster's daily cap and the site's address and
 * name. Every line it logs carries the request id and no address or text.
 */
export function createEnquiryMailDeps(requestId: string): EnquiryMailDeps {
  const log = logger.child({ requestId, route: "enquiry-mail" });
  return {
    sender: chooseMailSender(
      {
        APP_ENV: env.APP_ENV,
        RESEND_API_KEY: env.RESEND_API_KEY,
        MAIL_FROM: env.MAIL_FROM,
        MAIL_REPLY_TO: env.MAIL_REPLY_TO,
        MAIL_DEV_ALLOWLIST: env.MAIL_DEV_ALLOWLIST,
      },
      { onSkip: () => log.info("enquiry mail skipped: the address is not on the test list") },
    ),
    getTemplates: getMailTemplates,
    withinCap: (posterId) => hitKeyedRateLimit({ scope: "enquiry_mail", key: posterId, requestId }),
    siteName: messages.meta.title,
    absoluteUrl: (path) => new URL(path, publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
    log,
  };
}
