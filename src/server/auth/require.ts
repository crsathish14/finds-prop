import "server-only";
import { assertAdmin, assertBuilder, assertUser, assertVerifiedPhone } from "./guards";
import { getSessionView } from "./get-session-view";
import type { SessionView } from "./session";

/** Read the session, then guard. Use these in handlers; actions get the same checks from defineAction. */

export async function requireUser(): Promise<SessionView> {
  const session = await getSessionView();
  assertUser(session);
  return session;
}

export async function requireVerifiedPhone(): Promise<SessionView> {
  const session = await getSessionView();
  assertVerifiedPhone(session);
  return session;
}

export async function requireAdmin(): Promise<SessionView> {
  const session = await getSessionView();
  assertAdmin(session);
  return session;
}

export async function requireBuilder(): Promise<SessionView & { builderId: string }> {
  const session = await getSessionView();
  assertBuilder(session);
  return session;
}
