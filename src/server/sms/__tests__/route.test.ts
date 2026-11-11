import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const signingBytes = Buffer.from("test-signing-key-for-the-hook");
const environment: Record<string, string | undefined> = {
  APP_ENV: "local",
  SEND_SMS_HOOK_SECRET: `v1,whsec_${signingBytes.toString("base64")}`,
};
vi.mock("@/server/env", () => ({ env: environment }));

function signedNow(text: string) {
  const id = "msg_route_0001";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", signingBytes)
    .update(`${id}.${timestamp}.${text}`)
    .digest("base64");
  return {
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  };
}

describe("UT-send-sms-route: the route handler", () => {
  it("exports POST only, so every other method is refused by the framework", async () => {
    const route = await import("@/app/api/auth/hooks/send-sms/route");
    expect(Object.keys(route).sort()).toEqual(["POST"]);
  });

  it("answers a signed request in local without calling any provider", async () => {
    const { POST } = await import("@/app/api/auth/hooks/send-sms/route");
    const text = JSON.stringify({ user: { phone: "919000000001" }, sms: { otp: "123456" } });
    const response = await POST(
      new Request("https://example.test/api/auth/hooks/send-sms", {
        method: "POST",
        headers: signedNow(text),
        body: text,
      }),
    );
    expect(response.status).toBe(200);
  });

  it("refuses an unsigned request", async () => {
    const { POST } = await import("@/app/api/auth/hooks/send-sms/route");
    const response = await POST(
      new Request("https://example.test/api/auth/hooks/send-sms", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(401);
  });

  it("refuses a signed request in production when no SMS provider is configured, instead of pretending", async () => {
    environment.APP_ENV = "production";
    try {
      const { POST } = await import("@/app/api/auth/hooks/send-sms/route");
      const text = JSON.stringify({ user: { phone: "919000000001" }, sms: { otp: "123456" } });
      const response = await POST(
        new Request("https://example.test/api/auth/hooks/send-sms", {
          method: "POST",
          headers: signedNow(text),
          body: text,
        }),
      );
      expect(response.status).toBe(502);
    } finally {
      environment.APP_ENV = "local";
    }
  });
});
