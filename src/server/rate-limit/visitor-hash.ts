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

const IPV4_PATTERN = /^\d{1,3}(?:\.\d{1,3}){3}$/;
const HEXTET_PATTERN = /^[0-9a-f]{1,4}$/;

/** The colon-separated groups of one side of an IPv6 address; a dotted IPv4 tail becomes two groups. */
function groupsOf(text: string): string[] | null {
  if (text === "") return [];
  const parts = text.split(":");
  const last = parts.pop() ?? "";
  if (IPV4_PATTERN.test(last)) {
    const octets = last.split(".").map(Number);
    if (octets.some((octet) => octet > 255)) return null;
    const [first = 0, second = 0, third = 0, fourth = 0] = octets;
    parts.push(((first << 8) | second).toString(16), ((third << 8) | fourth).toString(16));
  } else {
    parts.push(last);
  }
  return parts.every((part) => HEXTET_PATTERN.test(part)) ? parts : null;
}

/** The eight 16-bit values of an IPv6 address (`::`, a zone and brackets handled), or null if it is not one. */
function ipv6Numbers(address: string): number[] | null {
  const [bare = ""] = address
    .replace(/^\[|\]$/g, "")
    .toLowerCase()
    .split("%");
  const halves = bare.split("::");
  if (halves.length > 2) return null;
  const head = groupsOf(halves[0] ?? "");
  const tail = halves[1] === undefined ? [] : groupsOf(halves[1]);
  if (head === null || tail === null) return null;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const zeros = Array.from({ length: missing }, () => "0");
  return [...head, ...zeros, ...tail].map((group) => Number.parseInt(group, 16));
}

/**
 * The address as the network counts it (ADR-128 section 7.1). An IPv4 address stays whole. An IPv6 address is cut
 * to its /64 prefix, because one subscriber owns a whole /64 block and can rotate through its addresses; the
 * same block is always written the same way. An IPv4 address inside IPv6 (`::ffff:203.0.113.7`) counts as that
 * IPv4 address. Text that is not an address is returned unchanged, so a strange header still counts as something.
 */
export function networkAddress(address: string): string {
  if (!address.includes(":")) return address;
  const numbers = ipv6Numbers(address);
  if (numbers === null) return address;
  const [first = 0, second = 0, third = 0, fourth = 0, fifth = 0, sixth = 0, high = 0, low = 0] =
    numbers;
  if (first + second + third + fourth + fifth === 0 && sixth === 0xffff) {
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return `${[first, second, third, fourth].map((group) => group.toString(16)).join(":")}::/64`;
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
