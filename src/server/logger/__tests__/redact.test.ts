import { describe, expect, it } from "vitest";
import { createLogger } from "@/server/logger";
import { REDACTED, maskEmail, maskPhone, redactText, redactValue } from "@/lib/redact";

describe("UT-redact: values", () => {
  it("redacts values under secret-looking keys", () => {
    const out = redactValue({
      password: "hunter2",
      otp: "123456",
      accessToken: "abc",
      Authorization: "Bearer abc",
      cookie: "sb=1",
      SUPABASE_SERVICE_ROLE_KEY: "key",
      crmCredentials: { user: "u" },
    }) as Record<string, unknown>;
    for (const value of Object.values(out)) expect(value).toBe(REDACTED);
  });

  it("redacts message bodies", () => {
    expect(redactValue({ message: "call me on 98765 43210", body: "x" })).toEqual({
      message: REDACTED,
      body: REDACTED,
    });
  });

  it("masks phone and email fields to a few trailing characters", () => {
    const out = redactValue({ phone: "+919876543210", email: "priya.raman@example.com" }) as Record<
      string,
      string
    >;
    expect(out.phone).toBe("+*********210");
    expect(out.email).toBe("p***@example.com");
  });

  it("redacts a phone number, an email and a token inside free text", () => {
    const text = "failed for +91 98765 43210 and priya@example.com with Bearer abc.def.ghi";
    const out = redactText(text);
    expect(out).not.toContain("98765 43210");
    expect(out).not.toContain("priya@example.com");
    expect(out).not.toContain("abc.def.ghi");
  });

  it("redacts a JWT-like string wherever it appears", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dummysignaturevalue";
    expect(redactText(`token was ${jwt}`)).not.toContain("eyJhbGci");
  });

  it("walks nested objects and arrays and stops at a depth limit", () => {
    const out = redactValue({
      accounts: [{ password: "x" }],
      nested: { one: { two: { three: { four: { five: { six: 1 } } } } } },
    }) as {
      accounts: Array<{ password: string }>;
      nested: unknown;
    };
    expect(out.accounts[0]?.password).toBe(REDACTED);
    expect(JSON.stringify(out.nested)).toContain("[TRUNCATED]");
  });

  it("keeps only the name and a redacted message of an Error, never the stack", () => {
    const error = new Error("boom for priya@example.com");
    const out = redactValue(error) as { name: string; message: string };
    expect(out.name).toBe("Error");
    expect(out.message).not.toContain("priya@example.com");
    expect(JSON.stringify(out)).not.toContain("stack");
  });

  it("masks helpers behave on short or malformed input", () => {
    expect(maskPhone("123")).toBe(REDACTED);
    expect(maskEmail("not-an-email")).toBe(REDACTED);
  });
});

describe("UT-redact: logger", () => {
  const collect = () => {
    const lines: string[] = [];
    const logger = createLogger(
      {},
      { write: (line) => lines.push(line), now: () => new Date("2026-10-30T10:00:00Z") },
    );
    return { lines, logger };
  };

  it("writes one JSON object per line with the fixed fields", () => {
    const { lines, logger } = collect();
    logger.info("hello", { requestId: "r1", route: "/x", durationMs: 12 });
    expect(JSON.parse(lines[0] as string)).toEqual({
      level: "info",
      msg: "hello",
      time: "2026-10-30T10:00:00.000Z",
      requestId: "r1",
      route: "/x",
      durationMs: 12,
    });
  });

  it("redacts fields before writing", () => {
    const { lines, logger } = collect();
    logger.error("failed", { password: "secret", phone: "9876543210" });
    const parsed = JSON.parse(lines[0] as string) as Record<string, string>;
    expect(parsed.password).toBe(REDACTED);
    expect(lines[0]).not.toContain("9876543210");
  });

  it("respects the level threshold", () => {
    const lines: string[] = [];
    const logger = createLogger({}, { level: "warn", write: (line) => lines.push(line) });
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(lines).toHaveLength(2);
  });

  it("child loggers add their fields to every line", () => {
    const { lines, logger } = collect();
    logger.child({ requestId: "abc" }).info("x");
    expect(JSON.parse(lines[0] as string).requestId).toBe("abc");
  });
});
