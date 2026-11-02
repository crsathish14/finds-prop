import type { Logger } from "../logger";
import type { SessionView } from "./session";
import {
  classifyCallbackProblem,
  decideStaffLanding,
  isStaffArea,
  staffLoginPath,
} from "./staff-sign-in";

/** What Supabase put in the callback's query string, read but not yet trusted. */
export interface StaffCallbackQuery {
  code: string | null;
  error: string | null;
  errorDescription: string | null;
  area: string | null;
  next: string | null;
}

export interface StaffCallbackDeps {
  /** supabase.auth.exchangeCodeForSession: trades the one-time code and the PKCE cookie for a session. */
  exchangeCode(code: string): Promise<{ error: unknown }>;
  /** The session view, read through the same client that made the session. */
  readSession(): Promise<SessionView | null>;
  /** Ends this browser's session only (scope local), not the user's other devices. */
  signOut(): Promise<void>;
  /** A history entry (R-BE-12). Names and ids only. */
  audit(event: {
    action: "staff.signed_in" | "staff.sign_in_denied";
    session: SessionView;
  }): Promise<void>;
  log: Logger;
}

/**
 * Finishes a staff Google sign-in and answers with the path to send the visitor to. The browser is
 * only ever sent to one of our own paths, and never learns why a sign-in was refused: every
 * refusal is the same "denied" page state.
 *
 *  1. an error Supabase reported (the guard's refusal, a cancelled Google screen) goes straight back;
 *  2. the code is exchanged for a session;
 *  3. eligibility comes from the session the server read, never from the `area` or `next` the
 *     address carried (R-BE-03): a builder needs the role and an active record, the administrator
 *     needs `super_admin`;
 *  4. a visitor who is not eligible is signed out again and sent back.
 *
 * The log never holds the code, an email or a name.
 */
export async function handleStaffCallback(
  query: StaffCallbackQuery,
  deps: StaffCallbackDeps,
): Promise<string> {
  const { log } = deps;
  if (!isStaffArea(query.area)) {
    log.warn("staff sign-in callback without a valid area");
    return staffLoginPath("builder", "error");
  }
  const area = query.area;

  const reported = classifyCallbackProblem(query.error, query.errorDescription);
  if (reported) {
    log.warn("staff sign-in did not finish", { area, problem: reported });
    return staffLoginPath(area, reported);
  }
  if (!query.code) {
    log.warn("staff sign-in callback without a code", { area });
    return staffLoginPath(area, "error");
  }

  let session: SessionView | null;
  try {
    const exchanged = await deps.exchangeCode(query.code);
    if (exchanged.error) {
      log.warn("staff sign-in code exchange failed", { area });
      return staffLoginPath(area, "error");
    }
    session = await deps.readSession();
  } catch (error) {
    log.error("staff sign-in could not read the new session", { area, error });
    await signOutQuietly(deps);
    return staffLoginPath(area, "error");
  }

  const who = session ? { userId: session.userId } : {};
  const landing = decideStaffLanding(area, session, query.next);
  if (landing.allowed) {
    await auditQuietly(deps, "staff.signed_in", session);
    log.info("staff signed in", { area, ...who });
    return landing.redirectTo;
  }

  await auditQuietly(deps, "staff.sign_in_denied", session);
  await signOutQuietly(deps);
  log.warn("staff sign-in denied", { area, ...who });
  return landing.redirectTo;
}

/** A failing history entry must not lock a signed-in builder out, so it is logged and the sign-in goes on. */
async function auditQuietly(
  deps: StaffCallbackDeps,
  action: "staff.signed_in" | "staff.sign_in_denied",
  session: SessionView | null,
): Promise<void> {
  if (!session) return;
  try {
    await deps.audit({ action, session });
  } catch (error) {
    deps.log.error("staff sign-in audit entry failed", { action, error });
  }
}

async function signOutQuietly(deps: StaffCallbackDeps): Promise<void> {
  try {
    await deps.signOut();
  } catch (error) {
    deps.log.error("staff sign-in could not end the session", { error });
  }
}
