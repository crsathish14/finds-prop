import { describe, expect, it } from "vitest";
import {
  assertSafeUrl,
  checkUrl,
  isBlockedAddress,
  UnsafeUrlError,
  type HostLookup,
} from "../safe-url";

const reasonOf = async (run: () => unknown): Promise<string> => {
  try {
    await run();
  } catch (error) {
    if (error instanceof UnsafeUrlError) return error.reason;
    throw error;
  }
  return "allowed";
};

const publicLookup: HostLookup = async () => ["93.184.216.34"];

describe("UT-crm-url: which addresses a CRM call may use (S7-T09, BR-65, SEC-07)", () => {
  it("allows a public https address, with a path, a port and a query", async () => {
    expect(await reasonOf(() => assertSafeUrl("https://api.crm-vendor.com", publicLookup))).toBe(
      "allowed",
    );
    expect(
      await reasonOf(() =>
        assertSafeUrl("https://hooks.vendor.io:8443/v2/leads?x=1", publicLookup),
      ),
    ).toBe("allowed");
  });

  it.each([
    ["http://api.crm-vendor.com", "not_https"],
    ["ftp://api.crm-vendor.com", "not_https"],
    ["//api.crm-vendor.com", "invalid"],
    ["not a url", "invalid"],
    ["https://", "invalid"],
    ["https://user:pass@api.crm-vendor.com", "credentials"],
    ["https://user@api.crm-vendor.com", "credentials"],
  ])("refuses %s (%s)", async (address, reason) => {
    expect(await reasonOf(() => assertSafeUrl(address, publicLookup))).toBe(reason);
  });

  it.each([
    "https://localhost/x",
    "https://LOCALHOST./x",
    "https://printer.local/x",
    "https://db.internal/x",
    "https://router.lan/x",
    "https://intranet/x",
    "https://metadata/x",
  ])("refuses the internal name %s", async (address) => {
    expect(await reasonOf(() => assertSafeUrl(address, publicLookup))).toBe("internal_name");
  });

  it.each([
    "https://127.0.0.1/",
    "https://10.1.2.3/",
    "https://172.16.0.1/",
    "https://172.31.255.255/",
    "https://192.168.1.1/",
    "https://169.254.169.254/latest/meta-data/",
    "https://100.64.0.1/",
    "https://0.0.0.0/",
    "https://224.0.0.1/",
    "https://255.255.255.255/",
    "https://198.18.0.1/",
  ])("refuses the private or reserved address %s", async (address) => {
    expect(await reasonOf(() => assertSafeUrl(address, publicLookup))).toBe("private_address");
  });

  it.each([
    ["decimal", "https://2130706433/"],
    ["hexadecimal", "https://0x7f000001/"],
    ["octal", "https://0177.0.0.1/"],
    ["short", "https://127.1/"],
    ["mixed", "https://0x7f.0.0.1/"],
    ["decimal metadata", "https://2852039166/"],
  ])("refuses a loopback or metadata address written in the %s form", async (_form, address) => {
    expect(await reasonOf(() => assertSafeUrl(address, publicLookup))).toBe("private_address");
  });

  it.each([
    "https://[::1]/",
    "https://[::]/",
    "https://[fe80::1]/",
    "https://[fc00::1]/",
    "https://[fd12:3456::1]/",
    "https://[::ffff:127.0.0.1]/",
    "https://[::ffff:7f00:1]/",
    "https://[::ffff:169.254.169.254]/",
    "https://[64:ff9b::7f00:1]/",
    "https://[ff02::1]/",
    "https://[2001:db8::1]/",
    "https://[2002:7f00:1::]/",
  ])("refuses the private IPv6 address %s", async (address) => {
    expect(await reasonOf(() => assertSafeUrl(address, publicLookup))).toBe("private_address");
  });

  it("allows a public IP address written out, v4 or v6, without a lookup", async () => {
    const never: HostLookup = async () => {
      throw new Error("no lookup expected");
    };
    expect(await reasonOf(() => assertSafeUrl("https://93.184.216.34/x", never))).toBe("allowed");
    expect(await reasonOf(() => assertSafeUrl("https://[2606:2800:220:1::1]/x", never))).toBe(
      "allowed",
    );
  });

  it("refuses a name that leads to a private address, even if only one of its addresses does", async () => {
    const inside: HostLookup = async () => ["10.0.0.5"];
    const mixed: HostLookup = async () => ["93.184.216.34", "127.0.0.1"];
    const mapped: HostLookup = async () => ["::ffff:10.0.0.5"];
    expect(await reasonOf(() => assertSafeUrl("https://crm.vendor.com", inside))).toBe(
      "private_address",
    );
    expect(await reasonOf(() => assertSafeUrl("https://crm.vendor.com", mixed))).toBe(
      "private_address",
    );
    expect(await reasonOf(() => assertSafeUrl("https://crm.vendor.com", mapped))).toBe(
      "private_address",
    );
  });

  it("refuses a name that does not resolve, or resolves to nothing", async () => {
    const missing: HostLookup = async () => {
      throw new Error("ENOTFOUND");
    };
    const empty: HostLookup = async () => [];
    expect(await reasonOf(() => assertSafeUrl("https://nowhere.vendor.com", missing))).toBe(
      "unresolved",
    );
    expect(await reasonOf(() => assertSafeUrl("https://nowhere.vendor.com", empty))).toBe(
      "unresolved",
    );
  });

  it("looks up the host name it was given, in lower case, once", async () => {
    const asked: string[] = [];
    const lookup: HostLookup = async (host) => {
      asked.push(host);
      return ["93.184.216.34"];
    };
    await assertSafeUrl("https://API.Vendor.com/x", lookup);
    expect(asked).toEqual(["api.vendor.com"]);
  });

  it("checks the shape without the network", () => {
    expect(checkUrl("https://api.crm-vendor.com/x").hostname).toBe("api.crm-vendor.com");
    expect(() => checkUrl("http://api.crm-vendor.com")).toThrow(UnsafeUrlError);
  });

  it("blocks what it cannot read as an address", () => {
    expect(isBlockedAddress("not-an-address")).toBe(true);
    expect(isBlockedAddress("")).toBe(true);
    expect(isBlockedAddress("93.184.216.34")).toBe(false);
    expect(isBlockedAddress("2606:2800:220:1::1")).toBe(false);
  });
});
