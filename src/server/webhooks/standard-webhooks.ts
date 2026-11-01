import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Checks a webhook signed the Standard Webhooks way, which is how Supabase signs its auth hooks
 * (R-BE-13). The caller sends three headers: webhook-id, webhook-timestamp and webhook-signature.
 * The signature is an HMAC-SHA256, in base64, of `<id>.<timestamp>.<raw body>` with the secret as
 * the key. The secret is stored as `v1,whsec_<base64 key>`. A header can hold several signatures
 * (`v1,<sig> v1,<sig>`) while a secret is being rotated; one valid signature is enough.
 *
 * Written with Node's own crypto, so no package is added. Comparison is constant time. A message
 * outside the time window is refused, so a captured request cannot be replayed later.
 */
export interface WebhookRequest {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  /** The raw body exactly as received, before any parsing. */
  body: string;
}

export type WebhookRefusal = "missing_headers" | "bad_secret" | "stale" | "bad_signature";

export type WebhookVerdict = { valid: true } | { valid: false; reason: WebhookRefusal };

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

function keyFromSecret(secret: string): Buffer | null {
  const encoded = secret.replace(/^v1,/, "").replace(/^whsec_/, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
  const key = Buffer.from(encoded, "base64");
  return key.length > 0 ? key : null;
}

export function verifyStandardWebhook(parameters: {
  secret: string;
  request: WebhookRequest;
  nowSeconds: number;
  toleranceSeconds?: number;
}): WebhookVerdict {
  const { id, timestamp, signature, body } = parameters.request;
  if (!id || !timestamp || !signature) return { valid: false, reason: "missing_headers" };

  const key = keyFromSecret(parameters.secret);
  if (!key) return { valid: false, reason: "bad_secret" };

  const sentAt = /^\d{1,12}$/.test(timestamp) ? Number(timestamp) : Number.NaN;
  const tolerance = parameters.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (!Number.isFinite(sentAt) || Math.abs(parameters.nowSeconds - sentAt) > tolerance) {
    return { valid: false, reason: "stale" };
  }

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();
  for (const entry of signature.split(" ")) {
    const [version, value] = entry.split(",");
    if (version !== "v1" || !value) continue;
    const received = Buffer.from(value, "base64");
    // Node's decoder stops at the padding and ignores what follows, so only the canonical form of
    // the signature is accepted: encoding it again must give back exactly what was sent.
    if (received.toString("base64") !== value) continue;
    if (received.length === expected.length && timingSafeEqual(received, expected)) {
      return { valid: true };
    }
  }
  return { valid: false, reason: "bad_signature" };
}
