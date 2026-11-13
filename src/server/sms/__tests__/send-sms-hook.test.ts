import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { createLogger } from "@/server/logger";
import { createFakeSmsSender, type FakeSmsSender } from "@/server/sms/fake";
import { handleSendSmsHook, type SendSmsHookDeps } from "@/server/sms/send-sms-hook";

const signingBytes = Buffer.from("test-signing-key-for-the-hook");
const configured = `v1,whsec_${signingBytes.toString("base64")}`;
const now = 1730000000;

function body(overrides: { phone?: string; otp?: string } = {}) {
  return JSON.stringify({
    user: { phone: overrides.phone ?? "919000000001" },
    sms: { otp: overrides.otp ?? "123456" },
  });
}

/** A request signed the way Supabase signs it. */
function signed(text: string, options: { timestamp?: number; tamper?: boolean } = {}) {
  const id = "msg_test_0001";
  const timestamp = String(options.timestamp ?? now);
  const signature = createHmac("sha256", signingBytes)
    .update(`${id}.${timestamp}.${text}`)
    .digest("base64");
  return new Request("https://example.test/api/auth/hooks/send-sms", {
    method: "POST",
    headers: {
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${signature}`,
    },
    body: options.tamper ? text.replace("123456", "654321") : text,
  });
}

function setup(
  overrides: Partial<SendSmsHookDeps> = {},
  sender: FakeSmsSender = createFakeSmsSender(),
) {
  const lines: string[] = [];
  const deps: SendSmsHookDeps = {
    secret: configured,
    getSender: () => sender,
    nowSeconds: now,
    log: createLogger({}, { write: (line) => lines.push(line) }),
    ...overrides,
  };
  return { deps, sender, lines };
}

describe("UT-send-sms-hook: the signature is checked first (R-BE-13)", () => {
  it("sends the code for a correctly signed request", async () => {
    const { deps, sender } = setup();
    const response = await handleSendSmsHook(signed(body()), deps);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({});
    expect(sender.sent).toEqual([{ phone: "919000000001", code: "123456" }]);
  });

  it("refuses an unsigned request with 401 and an empty body, and sends nothing", async () => {
    const { deps, sender } = setup();
    const request = new Request("https://example.test/hook", { method: "POST", body: body() });
    const response = await handleSendSmsHook(request, deps);
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");
    expect(sender.sent).toEqual([]);
  });

  it("refuses a request whose body was changed after signing", async () => {
    const { deps, sender } = setup();
    const response = await handleSendSmsHook(signed(body(), { tamper: true }), deps);
    expect(response.status).toBe(401);
    expect(sender.sent).toEqual([]);
  });

  it("refuses a request that is too old, so a captured one cannot be replayed", async () => {
    const { deps, sender } = setup();
    const response = await handleSendSmsHook(signed(body(), { timestamp: now - 600 }), deps);
    expect(response.status).toBe(401);
    expect(sender.sent).toEqual([]);
  });

  it("refuses everything when the hook secret is not configured", async () => {
    const { deps, sender, lines } = setup({ secret: undefined });
    const response = await handleSendSmsHook(signed(body()), deps);
    expect(response.status).toBe(401);
    expect(sender.sent).toEqual([]);
    expect(lines.join("\n")).toContain("not configured");
  });

  it("checks the signature before reading the body: a bad signature on bad JSON is 401, not 400", async () => {
    const { deps } = setup();
    const request = new Request("https://example.test/hook", {
      method: "POST",
      headers: {
        "webhook-id": "x",
        "webhook-timestamp": String(now),
        "webhook-signature": "v1,AAAA",
      },
      body: "not json",
    });
    expect((await handleSendSmsHook(request, deps)).status).toBe(401);
  });
});

describe("UT-send-sms-hook: what it will send", () => {
  it("accepts a number with or without the plus", async () => {
    const { deps, sender } = setup();
    await handleSendSmsHook(signed(body({ phone: "+919000000001" })), deps);
    expect(sender.sent).toEqual([{ phone: "919000000001", code: "123456" }]);
  });

  it("refuses a number outside India (DEC-31) with a generic error", async () => {
    const { deps, sender } = setup();
    for (const phone of ["14155550123", "+447911123456", "919", "9190000000", "910000000001"]) {
      const response = await handleSendSmsHook(signed(body({ phone })), deps);
      expect(response.status).toBe(400);
      expect(JSON.stringify(await response.json())).not.toContain(phone);
    }
    expect(sender.sent).toEqual([]);
  });

  it("refuses a code that is not six digits, and a body of the wrong shape", async () => {
    const { deps, sender } = setup();
    for (const otp of ["12345", "1234567", "12345a", ""]) {
      expect((await handleSendSmsHook(signed(body({ otp })), deps)).status).toBe(400);
    }
    expect((await handleSendSmsHook(signed("{}"), deps)).status).toBe(400);
    expect((await handleSendSmsHook(signed("not json"), deps)).status).toBe(400);
    expect(sender.sent).toEqual([]);
  });
});

describe("UT-send-sms-hook: failures and logs (R-BE-10)", () => {
  it("answers 502 with a generic message when the provider fails, and never echoes the number or code", async () => {
    const failing = createFakeSmsSender({
      failWith: new Error("MSG91 said no to 919000000001 / 123456"),
    });
    const { deps, lines } = setup({}, failing);
    const response = await handleSendSmsHook(signed(body()), deps);
    expect(response.status).toBe(502);
    const text = JSON.stringify(await response.json());
    expect(text).not.toContain("919000000001");
    expect(text).not.toContain("123456");
    expect(text).not.toContain("MSG91");
    expect(lines.join("\n")).not.toContain("123456");
  });

  it("logs the provider's words for a failure of ours, as detail, without the number or the code", async () => {
    const failing = createFakeSmsSender({
      failWith: new ActionError(
        "UPSTREAM_FAILED",
        "The SMS provider refused the message (code 110: invalid DLT template ID)",
      ),
    });
    const { deps, lines } = setup({}, failing);
    const response = await handleSendSmsHook(signed(body()), deps);
    expect(response.status).toBe(502);
    const entry = JSON.parse(
      lines.find((line) => line.includes("could not send the code")) ?? "{}",
    );
    expect(entry.errorCode).toBe("UPSTREAM_FAILED");
    expect(entry.detail).toBe(
      "The SMS provider refused the message (code 110: invalid DLT template ID)",
    );
    const log = lines.join("\n");
    for (const value of ["919000000001", "9000000001", "123456"]) {
      expect(log).not.toContain(value);
    }
  });

  it("logs no detail for an error that is not ours, because it may hold anything", async () => {
    const failing = createFakeSmsSender({
      failWith: new Error("MSG91 said no to 919000000001 / 123456"),
    });
    const { deps, lines } = setup({}, failing);
    await handleSendSmsHook(signed(body()), deps);
    const entry = JSON.parse(
      lines.find((line) => line.includes("could not send the code")) ?? "{}",
    );
    expect(entry.errorCode).toBe("INTERNAL");
    expect(entry.detail).toBeUndefined();
    expect(lines.join("\n")).not.toContain("MSG91 said no");
  });

  it("answers 502 when no sender can be built for this environment", async () => {
    const { deps } = setup({
      getSender: () => {
        throw new Error("The SMS provider is not configured");
      },
    });
    expect((await handleSendSmsHook(signed(body()), deps)).status).toBe(502);
  });

  it("never writes the phone number or the code to the log, on success or on refusal", async () => {
    const { deps, lines } = setup();
    await handleSendSmsHook(signed(body()), deps);
    await handleSendSmsHook(signed(body(), { tamper: true }), deps);
    await handleSendSmsHook(signed(body({ phone: "14155550123" })), deps);
    const log = lines.join("\n");
    for (const value of ["919000000001", "14155550123", "123456", "654321"]) {
      expect(log).not.toContain(value);
    }
  });
});
