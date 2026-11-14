import { randomBytes } from "node:crypto";
import { AI_ANONYMOUS_COOKIE_MAX_AGE_SECONDS, AI_ANONYMOUS_COOKIE_NAME } from "@/config/ai";

/**
 * The anonymous cookie id of the AI chat (ADR-128 section 7.1, decision D13). A random first-party id that
 * counts the free trial per browser, because an address and browser pair is a weak identity (many people
 * share one carrier address). It is used for counting and abuse prevention only: it holds no personal data,
 * is never logged, and is hashed before it reaches the database. Clearing it gives a fresh trial, which the
 * per-address cap and the global daily budget still bound.
 */

/** 32 random bytes, written as 43 URL-safe characters. Anything else in the cookie is ignored as forged. */
const ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** The part of the framework's cookie store this helper needs, so tests do not need a request. */
export interface AnonymousIdCookieJar {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: AnonymousIdCookieOptions): void;
}

export interface AnonymousIdCookieOptions {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
}

/**
 * HttpOnly so no script can read it; `lax` rather than `strict` so a customer who arrives from a link
 * elsewhere keeps their cookie (a strict cookie would be dropped on that visit and hand out a second trial);
 * `secure` on every deployed environment. It lasts a year, the length of the trial.
 */
export function anonymousIdCookieOptions(secure: boolean): AnonymousIdCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: AI_ANONYMOUS_COOKIE_MAX_AGE_SECONDS,
  };
}

export function newAnonymousId(): string {
  return randomBytes(32).toString("base64url");
}

/** The browser's id, or null when it has none or sends something that is not one of ours. */
export function readAnonymousId(jar: Pick<AnonymousIdCookieJar, "get">): string | null {
  const value = jar.get(AI_ANONYMOUS_COOKIE_NAME)?.value;
  return value !== undefined && ID_PATTERN.test(value) ? value : null;
}

/**
 * The browser's id; a new one is made and set on the response when it has none. It can only set a cookie
 * where the framework allows it (a Route Handler or Server Action, not a Server Component).
 */
export function ensureAnonymousId(
  jar: AnonymousIdCookieJar,
  options: { secure: boolean },
): { id: string; created: boolean } {
  const existing = readAnonymousId(jar);
  if (existing !== null) return { id: existing, created: false };
  const id = newAnonymousId();
  jar.set(AI_ANONYMOUS_COOKIE_NAME, id, anonymousIdCookieOptions(options.secure));
  return { id, created: true };
}
