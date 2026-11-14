import type { ErrorEvent } from "@sentry/browser";
import { describe, expect, it } from "vitest";
import { REDACTED } from "@/lib/redact";
import { scrubEvent } from "@/lib/scrub-event";

/** A report as the SDK builds it, with everything it likes to add and we must not send. */
function fullEvent(): ErrorEvent {
  return {
    type: undefined,
    event_id: "e1",
    timestamp: 1_700_000_000,
    platform: "javascript",
    level: "error",
    environment: "dev",
    release: "abc123",
    server_name: "ip-10-0-0-1",
    message: "Could not text +91 98765 43210 or email priya.raman@example.com",
    transaction: "/properties/[slug]",
    user: {
      id: "u1",
      email: "priya.raman@example.com",
      ip_address: "49.37.1.2",
      username: "priya",
    },
    request: {
      url: "https://dev.findsprop.com/dashboard?token=abc.def.ghi&phone=9876543210#frag",
      method: "POST",
      headers: { cookie: "sb-access-token=secret", authorization: "Bearer abc", "user-agent": "x" },
      cookies: { "sb-access-token": "secret" },
      data: { phone: "+919876543210", message: "I want to buy a flat" },
      query_string: "phone=9876543210",
      env: { REMOTE_ADDR: "49.37.1.2" },
    },
    breadcrumbs: [{ category: "console", message: "otp 123456" }],
    extra: { body: "hello", password: "hunter2" },
    contexts: {
      browser: { name: "Chrome", version: "130" },
      device: { model: "Pixel", device_id: "d1" },
      trace: { trace_id: "t1" },
      response: { headers: { "set-cookie": "sb=1" } },
    },
    tags: {
      request_id: "req-abcdefgh",
      route: "createEnquiry",
      error_code: "INTERNAL",
      customer_phone: "9876543210",
    },
    exception: {
      values: [
        {
          type: "Error",
          value: "failed for priya.raman@example.com with Bearer abc.def.ghi",
          stacktrace: {
            frames: [
              {
                filename: "https://dev.findsprop.com/_next/static/chunks/app.js?v=token123",
                function: "submit",
                lineno: 10,
                colno: 5,
                in_app: true,
                vars: { phone: "9876543210", password: "hunter2" },
                pre_context: ["const secret = 1"],
                context_line: "throw new Error(phone)",
                post_context: ["}"],
              },
            ],
          },
        },
      ],
    },
  } as unknown as ErrorEvent;
}

describe("UT-redact: error report scrubbing", () => {
  const scrubbed = scrubEvent(fullEvent());
  const text = JSON.stringify(scrubbed);

  it("never contains a phone number, an email, a token or a secret", () => {
    for (const leak of [
      "98765",
      "9876543210",
      "priya.raman@example.com",
      "abc.def.ghi",
      "hunter2",
      "sb-access-token",
      "123456",
      "49.37.1.2",
      "token123",
      "I want to buy a flat",
    ]) {
      expect(text).not.toContain(leak);
    }
  });

  it("drops the user, headers, cookies, body, breadcrumbs, extras and local variables", () => {
    expect(scrubbed).not.toHaveProperty("user");
    expect(scrubbed).not.toHaveProperty("breadcrumbs");
    expect(scrubbed).not.toHaveProperty("extra");
    expect(scrubbed).not.toHaveProperty("server_name");
    expect(scrubbed.request).toEqual({
      url: "https://dev.findsprop.com/dashboard",
      method: "POST",
    });
    const frame = scrubbed.exception?.values?.[0]?.stacktrace?.frames?.[0];
    expect(frame).not.toHaveProperty("vars");
    expect(frame).not.toHaveProperty("context_line");
    expect(frame).not.toHaveProperty("pre_context");
  });

  it("keeps what is needed to find and fix the bug", () => {
    expect(scrubbed.event_id).toBe("e1");
    expect(scrubbed.environment).toBe("dev");
    expect(scrubbed.release).toBe("abc123");
    expect(scrubbed.transaction).toBe("/properties/[slug]");
    expect(scrubbed.tags).toEqual({
      request_id: "req-abcdefgh",
      route: "createEnquiry",
      error_code: "INTERNAL",
    });
    expect(scrubbed.contexts).toEqual({ browser: { name: "Chrome", version: "130" } });
    const [entry] = scrubbed.exception?.values ?? [];
    expect(entry?.type).toBe("Error");
    expect(entry?.value).toContain(`Bearer ${REDACTED}`);
    expect(entry?.stacktrace?.frames?.[0]).toMatchObject({
      function: "submit",
      lineno: 10,
      colno: 5,
      in_app: true,
      filename: "https://dev.findsprop.com/_next/static/chunks/app.js",
    });
  });

  it("handles a report that has almost nothing in it", () => {
    expect(scrubEvent({ type: undefined } as ErrorEvent)).toEqual({ type: undefined });
  });
});
