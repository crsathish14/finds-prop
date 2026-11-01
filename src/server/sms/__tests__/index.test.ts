import { describe, expect, it, vi } from "vitest";
import { chooseSmsSender } from "@/server/sms";
import { createFakeSmsSender } from "@/server/sms/fake";

const message = { phone: "919000000001", code: "123456" };

describe("UT-sms: choosing the sender", () => {
  it("uses MSG91 when the key and the template are both set", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ type: "success", message: "id" }));
    const sender = chooseSmsSender(
      { APP_ENV: "production", MSG91_AUTH_KEY: "test-authkey-value", MSG91_TEMPLATE_ID: "tmpl-1" },
      fetchImpl,
    );
    await sender.sendOtp(message);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("uses a sender that sends nothing in local and dev when MSG91 is not set up", async () => {
    for (const APP_ENV of ["local", "dev"] as const) {
      const fetchImpl = vi.fn<typeof fetch>();
      const sender = chooseSmsSender({ APP_ENV }, fetchImpl);
      await expect(sender.sendOtp(message)).resolves.toBeUndefined();
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("refuses in staging and production when MSG91 is not set up, instead of pretending", () => {
    for (const APP_ENV of ["staging", "production"] as const) {
      expect(() => chooseSmsSender({ APP_ENV })).toThrow(/not configured/);
    }
  });

  it("refuses a half-configured MSG91 in production", () => {
    expect(() =>
      chooseSmsSender({ APP_ENV: "production", MSG91_AUTH_KEY: "test-authkey-value" }),
    ).toThrow(/not configured/);
    expect(() => chooseSmsSender({ APP_ENV: "production", MSG91_TEMPLATE_ID: "tmpl-1" })).toThrow(
      /not configured/,
    );
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
