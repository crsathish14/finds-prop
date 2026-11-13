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

  describe("S8-T04 (ADR-125): the route refuses a caller that cannot sign", () => {
    const text = JSON.stringify({ user: { phone: "919000000001" }, sms: { otp: "123456" } });
    const send = async (headers: Record<string, string>, body = text) => {
      const { POST } = await import("@/app/api/auth/hooks/send-sms/route");
      return POST(
        new Request("https://example.test/api/auth/hooks/send-sms", {
          method: "POST",
          headers,
          body,
        }),
      );
    };

    it("refuses a signature made with another key", async () => {
      const headers = signedNow(text);
      const wrong = createHmac("sha256", Buffer.from("some-other-signing-key"))
        .update(`${headers["webhook-id"]}.${headers["webhook-timestamp"]}.${text}`)
        .digest("base64");
      expect((await send({ ...headers, "webhook-signature": `v1,${wrong}` })).status).toBe(401);
    });

    it("refuses a good signature on a body that was changed afterwards", async () => {
      const changed = JSON.stringify({ user: { phone: "919000000002" }, sms: { otp: "123456" } });
      expect((await send(signedNow(text), changed)).status).toBe(401);
    });

    it("refuses a signature that is too old", async () => {
      const headers = signedNow(text);
      const old = String(Number(headers["webhook-timestamp"]) - 3600);
      const signature = createHmac("sha256", signingBytes)
        .update(`${headers["webhook-id"]}.${old}.${text}`)
        .digest("base64");
      const response = await send({
        ...headers,
        "webhook-timestamp": old,
        "webhook-signature": `v1,${signature}`,
      });
      expect(response.status).toBe(401);
    });

    it.each([
      ["no webhook headers but a session cookie", { cookie: "sb-access-token=anything" }],
      ["only a bearer token", { authorization: "Bearer anything" }],
      ["a signature and no id or timestamp", { "webhook-signature": "v1,AAAA" }],
    ])("refuses a request with %s", async (_what, headers) => {
      expect((await send(headers)).status).toBe(401);
    });

    it("refuses everything, even a correct signature, when no secret is configured", async () => {
      const saved = environment.SEND_SMS_HOOK_SECRET;
      environment.SEND_SMS_HOOK_SECRET = undefined;
      try {
        expect((await send(signedNow(text))).status).toBe(401);
      } finally {
        environment.SEND_SMS_HOOK_SECRET = saved;
      }
    });
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
