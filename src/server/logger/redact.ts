/**
 * Redaction for log lines and error reports (R-BE-10, plan 07 section 12).
 * Never logged: passwords, OTPs, tokens, cookies, authorization headers, service keys, CRM
 * credentials, full phone numbers or emails (masked to the last characters), message bodies.
 */
export const REDACTED = "[REDACTED]";

const SECRET_KEY =
  /(pass(word)?|otp|token|secret|cookie|authorization|api[-_]?key|service[-_]?role|credential|private[-_]?key|bearer|session)/i;
const BODY_KEY = /^(message|body|content|description|text)$/i;
const PHONE_KEY = /(phone|mobile|msisdn)/i;
const EMAIL_KEY = /e[-_]?mail/i;

const JWT_LIKE = /\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g;
const BEARER = /\bBearer\s+[\w.~+/-]+=*/gi;
const EMAIL_VALUE = /\b[\w.+-]+@[\w-]+(\.[\w-]+)+\b/g;
const PHONE_VALUE = /(?<![\w.])\+?\d[\d\s-]{8,}\d(?![\w.])/g;

const MAX_DEPTH = 6;

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return REDACTED;
  return `${value.trim().startsWith("+") ? "+" : ""}${"*".repeat(Math.max(digits.length - 3, 3))}${digits.slice(-3)}`;
}

export function maskEmail(value: string): string {
  const at = value.indexOf("@");
  if (at < 1) return REDACTED;
  return `${value.slice(0, 1)}***${value.slice(at)}`;
}

/** Redact secrets and personal data that appear inside free text. */
export function redactText(text: string): string {
  return text
    .replace(JWT_LIKE, REDACTED)
    .replace(BEARER, `Bearer ${REDACTED}`)
    .replace(EMAIL_VALUE, (match) => maskEmail(match))
    .replace(PHONE_VALUE, (match) => maskPhone(match));
}

export function redactValue(value: unknown, key = "", depth = 0): unknown {
  if (SECRET_KEY.test(key) || BODY_KEY.test(key)) return REDACTED;
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (PHONE_KEY.test(key)) return maskPhone(value);
    if (EMAIL_KEY.test(key)) return maskEmail(value);
    return redactText(value);
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return PHONE_KEY.test(key) ? REDACTED : value;
  }
  if (value instanceof Error) {
    return { name: value.name, message: redactText(value.message) };
  }
  if (depth >= MAX_DEPTH) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.map((item) => redactValue(item, key, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([childKey, childValue]) => [
        childKey,
        redactValue(childValue, childKey, depth + 1),
      ]),
    );
  }
  return String(value);
}
