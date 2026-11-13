import { describe, expect, it, vi } from "vitest";
import { chooseSmsSender } from "@/server/sms";
import { createFakeSmsSender } from "@/server/sms/fake";

const message = { phone: "919000000001", code: "123456" };

const ping4sms = {
  PING4SMS_API_KEY: "fake-api-key-for-tests",
  PING4SMS_SENDER_ID: "TESTSM",
  PING4SMS_TEMPLATE_ID: "1000000000000000001",
  PING4SMS_MESSAGE: "Your test code is {#var#}.",
};
const msg91 = { MSG91_AUTH_KEY: "test-authkey-value", MSG91_TEMPLATE_ID: "tmpl-1" };

describe("UT-sms: choosing the sender", () => {
  it("uses Ping4SMS when its settings are all there and no provider is named", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("100000001"));
    const sender = chooseSmsSender({ APP_ENV: "production", ...ping4sms }, fetchImpl);
    await sender.sendOtp(message);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [address] = fetchImpl.mock.calls[0] ?? [];
    expect(new URL(String(address)).host).toBe("site.ping4sms.com");
    expect(new URL(String(address)).searchParams.get("route")).toBe("2");
  });

  it("takes the route from the setting when there is one", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("100000001"));
    const sender = chooseSmsSender(
      { APP_ENV: "production", ...ping4sms, PING4SMS_ROUTE: "7" },
      fetchImpl,
    );
    await sender.sendOtp(message);
    const [address] = fetchImpl.mock.calls[0] ?? [];
    expect(new URL(String(address)).searchParams.get("route")).toBe("7");
  });

  it("uses MSG91 only when it is named and its key and template are both set", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ type: "success", message: "id" }));
    const sender = chooseSmsSender(
      { APP_ENV: "production", SMS_PROVIDER: "msg91", ...msg91 },
      fetchImpl,
    );
    await sender.sendOtp(message);
    const [address] = fetchImpl.mock.calls[0] ?? [];
    expect(new URL(String(address)).host).toBe("control.msg91.com");
  });

  it("does not fall back to MSG91 because its settings happen to be present", () => {
    expect(() => chooseSmsSender({ APP_ENV: "production", ...msg91 })).toThrow(/not configured/);
  });

  it("uses a sender that sends nothing in local and dev when no provider is set up", async () => {
    for (const APP_ENV of ["local", "dev"] as const) {
      const fetchImpl = vi.fn<typeof fetch>();
      const sender = chooseSmsSender({ APP_ENV }, fetchImpl);
      await expect(sender.sendOtp(message)).resolves.toBeUndefined();
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("refuses in staging and production when no provider is set up, instead of pretending", () => {
    for (const APP_ENV of ["staging", "production"] as const) {
      expect(() => chooseSmsSender({ APP_ENV })).toThrow(/not configured/);
    }
  });

  it("refuses a half-configured Ping4SMS in production", () => {
    for (const missing of Object.keys(ping4sms)) {
      const partial = Object.fromEntries(
        Object.entries(ping4sms).filter(([name]) => name !== missing),
      );
      expect(() => chooseSmsSender({ APP_ENV: "production", ...partial })).toThrow(
        /not configured/,
      );
    }
  });

  it("names the missing settings and the environment, never a value", () => {
    const saying = (config: Parameters<typeof chooseSmsSender>[0]) => {
      try {
        chooseSmsSender(config);
      } catch (error) {
        return error instanceof Error ? error.message : "";
      }
      return "";
    };
    expect(saying({ APP_ENV: "production" })).toBe(
      "The SMS provider is not configured (missing: PING4SMS_API_KEY, PING4SMS_SENDER_ID, PING4SMS_TEMPLATE_ID, PING4SMS_MESSAGE; APP_ENV is production)",
    );
    const partial = saying({
      APP_ENV: "staging",
      PING4SMS_API_KEY: "fake-api-key-for-tests",
      PING4SMS_MESSAGE: "Your test code is {#var#}.",
    });
    expect(partial).toBe(
      "The SMS provider is not configured (missing: PING4SMS_SENDER_ID, PING4SMS_TEMPLATE_ID; APP_ENV is staging)",
    );
    expect(partial).not.toContain("fake-api-key-for-tests");
    expect(saying({ APP_ENV: "production", SMS_PROVIDER: "msg91" })).toBe(
      "The SMS provider is not configured (missing: MSG91_AUTH_KEY, MSG91_TEMPLATE_ID; APP_ENV is production)",
    );
  });

  it("refuses a half-configured MSG91 in production", () => {
    expect(() =>
      chooseSmsSender({
        APP_ENV: "production",
        SMS_PROVIDER: "msg91",
        MSG91_AUTH_KEY: "test-authkey-value",
      }),
    ).toThrow(/not configured/);
    expect(() =>
      chooseSmsSender({
        APP_ENV: "production",
        SMS_PROVIDER: "msg91",
        MSG91_TEMPLATE_ID: "tmpl-1",
      }),
    ).toThrow(/not configured/);
  });

  it("refuses a Ping4SMS template with no place for the code", () => {
    expect(() =>
      chooseSmsSender({ APP_ENV: "production", ...ping4sms, PING4SMS_MESSAGE: "Your code" }),
    ).toThrow(/not configured/);
  });
});

describe("UT-sms: the fake sender", () => {
  it("remembers what it was asked to send and sends nothing", async () => {
    const fake = createFakeSmsSender();
    await fake.sendOtp(message);
    expect(fake.sent).toEqual([message]);
  });

  it("can be told to fail", async () => {
    const fake = createFakeSmsSender({ failWith: new Error("down") });
    await expect(fake.sendOtp(message)).rejects.toThrow("down");
    expect(fake.sent).toEqual([]);
  });
});
