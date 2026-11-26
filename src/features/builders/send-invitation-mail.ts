import "server-only";
import messages from "@/i18n/messages/en.json";
import { publicEnv } from "@/lib/public-env";
import { env } from "@/server/env";
import { logger } from "@/server/logger";
import { chooseMailSender } from "@/server/mail";
import type { InvitationMailFacts } from "./builder-service";
import { BUILDER_SIGN_IN_PATH } from "./constants";
import { deliverInvitationMail } from "./invitation-mail";

/**
 * Mails the greeting to an invited builder or agent (ADR-203). It is what the invite and resend actions put inside
 * `after()`, so the admin has already been answered and never waits for the mail provider. The sender is the one
 * for this environment (ADR-181: nothing without a key, only the test list on dev and staging) and the sign-in
 * address is built from our own site address, never from a request. Never throws.
 */
export async function sendInvitationMail(
  facts: InvitationMailFacts,
  requestId: string,
): Promise<void> {
  const log = logger.child({ requestId, route: "builder-invitation-mail" });
  await deliverInvitationMail(facts, {
    sender: chooseMailSender(
      {
        APP_ENV: env.APP_ENV,
        RESEND_API_KEY: env.RESEND_API_KEY,
        MAIL_FROM: env.MAIL_FROM,
        MAIL_REPLY_TO: env.MAIL_REPLY_TO,
        MAIL_DEV_ALLOWLIST: env.MAIL_DEV_ALLOWLIST,
      },
      { onSkip: () => log.info("invitation mail skipped: the address is not on the test list") },
    ),
    signInUrl: new URL(BUILDER_SIGN_IN_PATH, publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
    siteName: messages.meta.title,
    log,
  });
}
