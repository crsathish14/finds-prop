import { isIP } from "node:net";

/**
 * The address check for every outbound call to a CRM (S7-T09, BR-65, SEC-07, DEC-28, UT-crm-url). An address the admin
 * types is called from our server, so it must be a public https address and nothing else: no http, no sign-in details
 * in the address, no `localhost` or internal names, and no address in a private, loopback, link-local, metadata or
 * reserved range, in any spelling. The address is parsed with the platform's URL parser, which turns the odd spellings
 * (`2130706433`, `0x7f.1`, `0177.0.0.1`, `127.1`) into dotted form before this looks at them. The host is then
 * looked up and every address it answers with must be public too, so a name that points inside is refused. The caller
 * sends the request with redirects off, so a public address cannot bounce the call inside.
 */
export type UnsafeUrlReason =
  "invalid" | "not_https" | "credentials" | "internal_name" | "private_address" | "unresolved";

export class UnsafeUrlError extends Error {
  readonly reason: UnsafeUrlReason;
  constructor(reason: UnsafeUrlReason) {
    super(`CRM address refused: ${reason}`);
    this.name = "UnsafeUrlError";
    this.reason = reason;
  }
}

/** Looks a host name up. Answers every address it has; throws or answers nothing when there is none. */
export type HostLookup = (hostname: string) => Promise<string[]>;

export const lookupHost: HostLookup = async (hostname) => {
  const { lookup } = await import("node:dns/promises");
  const found = await lookup(hostname, { all: true, verbatim: true });
  return found.map((entry) => entry.address);
};

const INTERNAL_SUFFIX = /\.(local|localhost|internal|intranet|lan|home|corp|private)$/;

function blockedV4(address: string): boolean {
  const parts = address.split(".").map(Number);
  const [first = 0, second = 0, third = 0] = parts;
  return (
    first === 0 || // "this" network
    first === 10 || // private
    first === 127 || // loopback
    (first === 100 && second >= 64 && second <= 127) || // carrier-grade NAT
    (first === 169 && second === 254) || // link-local, including the cloud metadata address
    (first === 172 && second >= 16 && second <= 31) || // private
    (first === 192 && second === 0 && (third === 0 || third === 2)) || // protocol assignments, documentation
    (first === 192 && second === 88 && third === 99) || // 6to4 relay
    (first === 192 && second === 168) || // private
    (first === 198 && (second === 18 || second === 19)) || // benchmarking
    (first === 198 && second === 51 && third === 100) || // documentation
    (first === 203 && second === 0 && third === 113) || // documentation
    first >= 224 // multicast, reserved and broadcast
  );
}

/** The eight 16-bit groups of an IPv6 address, or null when it is not one. */
function groupsOfV6(address: string): number[] | null {
  let text = address.toLowerCase();
  const zone = text.indexOf("%");
  if (zone >= 0) text = text.slice(0, zone);
  // A trailing dotted IPv4 part (::ffff:1.2.3.4) is two groups.
  const dotted = /(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(text);
  if (dotted) {
    const octets = dotted.slice(1, 5).map(Number);
    if (octets.some((octet) => octet > 255)) return null;
    const high = ((octets[0] ?? 0) << 8) | (octets[1] ?? 0);
    const low = ((octets[2] ?? 0) << 8) | (octets[3] ?? 0);
    text = `${text.slice(0, dotted.index)}${high.toString(16)}:${low.toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [
    ...head,
    ...Array.from({ length: halves.length === 2 ? missing : 0 }, () => "0"),
    ...tail,
  ];
  const groups = all.map((group) => Number.parseInt(group, 16));
  return groups.length === 8 &&
    groups.every((group) => Number.isInteger(group) && group >= 0 && group <= 0xffff)
    ? groups
    : null;
}

function blockedV6(address: string): boolean {
  const groups = groupsOfV6(address);
  if (!groups) return true;
  const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
  const embedded = `${g6 >> 8}.${g6 & 255}.${g7 >> 8}.${g7 & 255}`;
  const zeros = (g0 | g1 | g2 | g3 | g4) === 0;
  return (
    (zeros && g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) || // unspecified, loopback
    (zeros && g5 === 0xffff && blockedV4(embedded)) || // IPv4-mapped
    (zeros && g5 === 0) || // IPv4-compatible (deprecated)
    (g0 === 0x64 && g1 === 0xff9b) || // NAT64 prefixes
    (g0 & 0xfe00) === 0xfc00 || // unique local
    (g0 & 0xffc0) === 0xfe80 || // link-local
    (g0 & 0xffc0) === 0xfec0 || // site-local (deprecated)
    (g0 & 0xff00) === 0xff00 || // multicast
    (g0 === 0x2001 && g1 === 0xdb8) || // documentation
    g0 === 0x2002 || // 6to4
    (g0 === 0x2001 && g1 === 0) // Teredo
  );
}

/** True when the address (v4 or v6, as text) is one a CRM call must never reach. Anything unreadable is blocked. */
export function isBlockedAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) return blockedV4(address);
  if (kind === 6) return blockedV6(address);
  return true;
}

/** The address as the platform reads it, after the checks that need no network. Throws `UnsafeUrlError`. */
export function checkUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("invalid");
  }
  if (url.protocol !== "https:") throw new UnsafeUrlError("not_https");
  if (url.username !== "" || url.password !== "") throw new UnsafeUrlError("credentials");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host === "") throw new UnsafeUrlError("invalid");
  if (host.startsWith("[")) {
    if (isBlockedAddress(host.slice(1, -1))) throw new UnsafeUrlError("private_address");
    return url;
  }
  if (isIP(host) !== 0) {
    if (isBlockedAddress(host)) throw new UnsafeUrlError("private_address");
    return url;
  }
  if (host === "localhost" || !host.includes(".") || INTERNAL_SUFFIX.test(host)) {
    throw new UnsafeUrlError("internal_name");
  }
  return url;
}

/**
 * The full check: the address is well formed and public, and so is every address the host name leads to. Run it at
 * save time, for a test, and again just before each delivery (a name can be pointed somewhere else later).
 */
export async function assertSafeUrl(raw: string, lookup: HostLookup = lookupHost): Promise<URL> {
  const url = checkUrl(raw);
  const host = url.hostname.toLowerCase();
  if (host.startsWith("[") || isIP(host) !== 0) return url;
  let addresses: string[];
  try {
    addresses = await lookup(host);
  } catch {
    throw new UnsafeUrlError("unresolved");
  }
  if (addresses.length === 0) throw new UnsafeUrlError("unresolved");
  if (addresses.some(isBlockedAddress)) throw new UnsafeUrlError("private_address");
  return url;
}
