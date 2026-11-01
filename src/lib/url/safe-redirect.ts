/**
 * BR-06: a "go back here after signing in" address must stay on this site. Only a path that starts
 * with a single slash is accepted. Anything that a browser could read as another site is refused:
 * `//host`, `/\host`, a full address, `javascript:`, and any of these hidden behind percent-encoding.
 * Pure, so the server and the sign-in form can share it.
 */
const MAX_LENGTH = 500;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function decodeOnce(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function startsLikeAnotherSite(path: string): boolean {
  return path.startsWith("//") || path.startsWith("/\\") || path.includes("\\");
}

export function isSafeRedirectPath(input: unknown): input is string {
  if (typeof input !== "string" || input.length === 0 || input.length > MAX_LENGTH) return false;
  if (!input.startsWith("/") || CONTROL_CHARACTERS.test(input)) return false;
  if (startsLikeAnotherSite(input)) return false;
  // Look at what the address means after decoding, up to twice, so %2F%2F or %5C cannot sneak in.
  let current = input;
  for (let pass = 0; pass < 2; pass += 1) {
    const decoded = decodeOnce(current);
    // A badly encoded address is refused; a second decode that fails only means the first one
    // already produced plain text (for example a literal percent sign).
    if (decoded === null) {
      if (pass === 0) return false;
      break;
    }
    if (CONTROL_CHARACTERS.test(decoded) || startsLikeAnotherSite(decoded)) return false;
    current = decoded;
  }
  return true;
}

/** The path when it is safe, otherwise the fallback (the home page unless told otherwise). */
export function safeRedirectPath(input: unknown, fallback = "/"): string {
  return isSafeRedirectPath(input) ? input : fallback;
}
