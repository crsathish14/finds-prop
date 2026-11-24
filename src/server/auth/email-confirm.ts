import { emailResultPath } from "@/lib/url/email-result";
import type { Logger } from "../logger";

/** What the email link's address carried, read but not yet trusted. */
export interface EmailConfirmQuery {
  tokenHash: string | null;
  type: string | null;
}

export interface EmailConfirmDeps {
  /** supabase.auth.verifyOtp: trades the single-use token for a confirmed email (and a session). */
  verifyOtp(credentials: {
    token_hash: string;
    type: "email_change";
  }): Promise<{ error: { code?: string | undefined } | null }>;
  /**
   * Copies the address just confirmed into the person's private contact email when they have none (ADR-196),
   * so enquiries and the account share one address. It acts on the session that verifyOtp just made.
   */
  adoptContactEmail(): Promise<{ error: { code?: string | undefined } | null }>;
  log: Logger;
}

/** Supabase's token hashes are URL-safe text; anything else is not one of ours. */
const TOKEN_HASH = /^[A-Za-z0-9_-]{10,200}$/;

/**
 * Finishes an email link and answers with the path to send the visitor to. Only a customer adding an
 * email uses it, so the type must be "email_change". The browser is only ever sent to one of our two
 * result pages and never learns why a link failed: a used, expired, malformed or missing link is the
 * same "expired" page (ADD-03). The log holds the error code only, never the token or an email.
 */
export async function handleEmailConfirm(
  query: EmailConfirmQuery,
  deps: EmailConfirmDeps,
): Promise<string> {
  const { tokenHash, type } = query;
  if (!tokenHash || !TOKEN_HASH.test(tokenHash) || type !== "email_change") {
    deps.log.warn("email link without a usable token");
    return emailResultPath("expired");
  }
  const { error } = await deps.verifyOtp({ token_hash: tokenHash, type });
  if (error) {
    deps.log.warn("email link refused", { errorCode: error.code ?? "none" });
    return emailResultPath("expired");
  }
  await adoptContactEmail(deps);
  return emailResultPath("verified");
}

/**
 * A failed copy never changes the answer: the address is confirmed either way, and the post-property page starts
 * the contact email box from the confirmed address when the copy was missed (ADR-196). Only the error code is
 * logged, never the address.
 */
async function adoptContactEmail(deps: EmailConfirmDeps): Promise<void> {
  try {
    const { error } = await deps.adoptContactEmail();
    if (error) deps.log.warn("contact email not copied", { errorCode: error.code ?? "none" });
  } catch {
    deps.log.warn("contact email not copied", { errorCode: "thrown" });
  }
}
