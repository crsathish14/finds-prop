import type { Database } from "@/types/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

const KNOWN_ROLES: readonly AppRole[] = ["super_admin", "agent", "builder", "customer"];

/**
 * Who is signed in, as the server decides it. Identity comes from the verified token and the
 * user's own database rows, never from anything the browser sent (R-BE-03).
 */
export interface SessionView {
  userId: string;
  roles: readonly AppRole[];
  /** The token carries a phone number, which only a phone-code sign-in produces. */
  phoneVerified: boolean;
  /**
   * The id of the active builder record. Set only when the user holds the builder role AND the
   * record is active (BR-34); an agent is a builder with a type, so the same rule applies.
   */
  builderId: string | null;
}

export interface SessionParts {
  claims: { sub?: unknown; phone?: unknown };
  roles: readonly string[];
  builderId: string | null;
}

/** Pure: puts verified token claims and the user's database rows together into one view. */
export function buildSessionView(parts: SessionParts): SessionView | null {
  const { sub, phone } = parts.claims;
  if (typeof sub !== "string" || sub.length === 0) return null;
  const roles = KNOWN_ROLES.filter((role) => parts.roles.includes(role));
  return {
    userId: sub,
    roles,
    phoneVerified: typeof phone === "string" && phone.length > 0,
    builderId: roles.includes("builder") ? parts.builderId : null,
  };
}
