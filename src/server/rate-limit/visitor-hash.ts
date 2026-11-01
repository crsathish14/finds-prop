import { createHmac } from "node:crypto";
import { ActionError } from "../actions/normalise-error";

/**
 * Who a visitor is, without ever storing who they are (BR-75, R-BE-10). The address and browser
 * are mixed with a server-only secret and cut to 40 hex characters; the raw address is never kept.
 */
const HASH_LENGTH = 40;
const LOCAL_ADDRESS = "127.0.0.1";

type HeaderReader = Pick<Headers, "get">;

/**
 * The caller's address (spike S1-SPK-03, ADR-033). On Vercel, `x-vercel-forwarded-for` is set by the
 * platform and not overwritten; `x-forwarded-for` is the fallback. Locally and in tests there is no
 * trustworthy proxy, so every caller is `127.0.0.1` and a made-up header changes nothing.
 */
export function clientIp(headers: HeaderReader, trustProxyHeaders: boolean): string {
  if (!trustProxyHeaders) return LOCAL_ADDRESS;
  const forwarded = headers.get("x-vercel-forwarded-for") ?? headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first ? first : LOCAL_ADDRESS;
}

function requireSecret(secret: string | undefined): string {
  if (!secret) {
    // Fail closed: without the secret an anonymous caller cannot be counted, so they are refused.
    throw new ActionError("INTERNAL", "RATE_LIMIT_HMAC_SECRET is not configured");
  }
  return secret;
}

export function hashValue(secret: string | undefined, ...parts: string[]): string {
  return createHmac("sha256", requireSecret(secret))
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, HASH_LENGTH);
}

export function visitorHash(secret: string | undefined, ip: string, userAgent: string): string {
  return hashValue(secret, ip, userAgent);
}
