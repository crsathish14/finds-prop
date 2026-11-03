export interface SessionEmail {
  signedIn: boolean;
  /** The email on the account, or null when the visitor is signed out or has none. */
  email: string | null;
}

/** Pure: reads the two things the email page needs from verified token claims. */
export function emailFromClaims(
  claims: { sub?: unknown; email?: unknown } | null | undefined,
): SessionEmail {
  if (!claims || typeof claims.sub !== "string" || claims.sub.length === 0) {
    return { signedIn: false, email: null };
  }
  const email = typeof claims.email === "string" && claims.email.length > 0 ? claims.email : null;
  return { signedIn: true, email };
}
