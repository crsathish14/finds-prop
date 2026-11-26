import { ActionError, classifyError } from "@/server/actions/normalise-error";
import type { Logger } from "@/server/logger";
import type { MailMessage, MailSender } from "@/server/mail";
import type { BuilderKind } from "./constants";

/**
 * The greeting an invited builder or agent gets when the admin adds them (ADR-203). Pure apart from the sender it is
 * given, so a test can check every word. Plain text, English, like the enquiry mails (ADR-181). The wording is a
 * default in code and is not yet approved by the owner; it is not editable on the Emails screen (a later change if
 * wanted).
 *
 * It says which kind of account was made (a builder or an agent, ADR-010), carries the sign-in address and says to
 * sign in with the Google account for that email, because that is how the invitation is matched. It holds no
 * password (there is none) and nothing about other people.
 */

/** How each kind reads in the mail, with the article that goes before it. */
export const INVITATION_KIND_LABELS: Readonly<
  Record<BuilderKind, { label: string; withArticle: string }>
> = {
  builder: { label: "Builder", withArticle: "a Builder" },
  agent: { label: "Agent", withArticle: "an Agent" },
};

export interface InvitationMailValues {
  /** The name on the record (a company for a builder, a person or firm for an agent). */
  name: string;
  /** The login email: the address the mail goes to and the Google account they must use. */
  email: string;
  kind: BuilderKind;
  /** The sign-in page as a whole address. */
  signInUrl: string;
  siteName: string;
}

/** The subject and text of the greeting. */
export function buildInvitationMail(values: InvitationMailValues): MailMessage {
  const type = INVITATION_KIND_LABELS[values.kind];
  const text = [
    `Hello ${values.name},`,
    "",
    `Welcome to ${values.siteName}. You have been added to ${values.siteName} as ${type.withArticle}.`,
    "",
    `Account type: ${type.label}`,
    "",
    "Sign in here with Google:",
    values.signInUrl,
    "",
    `Please use the Google account for ${values.email}. There is no password to remember.`,
    "",
    "If you were not expecting this, you can ignore this email.",
    "",
    values.siteName,
  ].join("\n");
  return {
    to: values.email,
    subject: `Welcome to ${values.siteName}: you have been added as ${type.withArticle}`,
    text,
  };
}

/** What a log line may say about a failure: its code and, for a provider failure only, the words the sender wrote (no address, no text). */
function failureFields(error: unknown): { errorCode: string; detail?: string } {
  const errorCode = classifyError(error);
  return error instanceof ActionError && error.code === "UPSTREAM_FAILED"
    ? { errorCode, detail: error.message }
    : { errorCode };
}

/** What `deliverInvitationMail` needs from outside, so a test can use a fake sender; the real ones are in `send-invitation-mail.ts`. */
export interface InvitationMailDeps {
  sender: MailSender;
  signInUrl: string;
  siteName: string;
  log: Logger;
}

/**
 * Writes and sends the greeting. Never throws: a mail that cannot be sent is logged (the kind and the failure code
 * only, never the address or a word of the text) and the admin still has the sign-in address on screen to pass on.
 * Returns whether the sender took the message, for a test; nothing in the app depends on it.
 */
export async function deliverInvitationMail(
  facts: { name: string; email: string; kind: BuilderKind },
  deps: InvitationMailDeps,
): Promise<boolean> {
  try {
    await deps.sender.send(
      buildInvitationMail({ ...facts, signInUrl: deps.signInUrl, siteName: deps.siteName }),
    );
    deps.log.info("invitation mail handed to the sender", { kind: facts.kind });
    return true;
  } catch (error) {
    deps.log.warn("invitation mail not sent", { kind: facts.kind, ...failureFields(error) });
    return false;
  }
}
