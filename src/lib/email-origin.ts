/**
 * Where a visitor was when they asked for the email link, so the "Email verified" page can take them back to it
 * (ADR-195). It is a per-browser convenience and nothing depends on it: the link can be opened on another device,
 * and storage can be missing or refuse to answer (a private window, blocked site data), so every access is guarded
 * and the answer then is the dashboard. Only two answers exist, so nothing from the address bar is ever stored or
 * followed.
 */
export type EmailOrigin = "post" | "dashboard";

const STORAGE_KEY = "findsprop:email-origin:v1";

export function rememberEmailOrigin(origin: EmailOrigin): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, origin);
  } catch {
    // The page then offers the dashboard, which is always a safe place to go.
  }
}

/** The origin to remember for a sign-in that was headed for `path`: posting only when the path is the post page. */
export function originOfPath(path: string): EmailOrigin {
  return path === "/post-property" || path.startsWith("/post-property/") ? "post" : "dashboard";
}

export function readEmailOrigin(): EmailOrigin {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "post" ? "post" : "dashboard";
  } catch {
    return "dashboard";
  }
}

export function subscribeEmailOrigin(listener: () => void): () => void {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}

/** What the server and the first browser render assume. */
export function serverEmailOrigin(): EmailOrigin {
  return "dashboard";
}
