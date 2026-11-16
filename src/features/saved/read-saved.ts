import type { SessionView } from "@/server/auth/session";

/** What the hearts need to know: who is signed in, and which homes they saved. */
export type SavedHomesRead =
  { signedIn: true; shortIds: string[] } | { signedIn: false; shortIds: string[] };

/**
 * Puts the visitor's session and their saved homes together. The action that calls this is open to
 * everyone (`auth: "none"`), so `defineAction` gives its handler no session; the handler reads the
 * session itself and passes it here. A visitor who is not signed in gets no homes, and the saved homes
 * are not read at all.
 */
export async function readSavedForSession(
  session: SessionView | null,
  readShortIds: () => Promise<string[]>,
): Promise<SavedHomesRead> {
  if (!session) return { signedIn: false, shortIds: [] };
  return { signedIn: true, shortIds: await readShortIds() };
}
