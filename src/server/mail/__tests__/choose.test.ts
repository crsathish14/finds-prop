import { describe, expect, it, vi } from "vitest";
import {
  chooseMailSender,
  createAllowlistMailSender,
  createFakeMailSender,
  isMailAllowed,
  parseMailAllowlist,
  type MailConfig,
} from "../index";

const message = {
  to: "tester@example.test",
  subject: "Someone asked about your home",
  text: "Open your dashboard to read it.",
};
const base: MailConfig = {
  APP_ENV: "production",
  RESEND_API_KEY: "fake-resend-key-for-tests",
  MAIL_FROM: "no-reply@mail.example.test",
  MAIL_REPLY_TO: "support@mail.example.test",
};

function okFetch() {
  return vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: "mail-1" }));
}

describe("UT-mail-allowlist: who dev and staging may mail (ADR-181)", () => {
  it("reads a comma separated list, ignoring case, spaces and empty entries", () => {
    expect(parseMailAllowlist(" Tester@Example.test, ,@Findsprop.com ,")).toEqual([
      "tester@example.test",
      "@findsprop.com",
    ]);
    expect(parseMailAllowlist(undefined)).toEqual([]);
    expect(parseMailAllowlist("")).toEqual([]);
  });

  it("allows an exact address or a whole domain, and nothing else", () => {
    const list = ["tester@example.test", "@findsprop.com"];
    expect(isMailAllowed("Tester@Example.test", list)).toBe(true);
    expect(isMailAllowed("anyone@findsprop.com", list)).toBe(true);
    expect(isMailAllowed("other@example.test", list)).toBe(false);
    expect(isMailAllowed("x@sub.findsprop.com", list)).toBe(false);
    expect(isMailAllowed("not-an-address", list)).toBe(false);
    expect(isMailAllowed("tester@example.test", [])).toBe(false);
  });

  it("passes an allowed message on and drops the rest, telling the caller only that one was dropped", async () => {
    const inner = createFakeMailSender();
    const onSkip = vi.fn();
    const sender = createAllowlistMailSender(inner, ["tester@example.test"], onSkip);
    await sender.send(message);
    await sender.send({ ...message, to: "stranger@example.test" });
    expect(inner.sent.map((sent) => sent.to)).toEqual(["tester@example.test"]);
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledWith();
  });
});

describe("UT-mail-choose: the sender for this environment (ADR-181)", () => {
  it("sends nothing and calls nothing without a key, in every environment", async () => {
    for (const APP_ENV of ["local", "dev", "staging", "production"] as const) {
      const fetchImpl = okFetch();
      const sender = chooseMailSender(
        { ...base, APP_ENV, RESEND_API_KEY: undefined },
        { fetchImpl },
      );
      await expect(sender.send(message)).resolves.toBeUndefined();
      expect(fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("never mails from a developer's machine, even with a key", async () => {
    const fetchImpl = okFetch();
    const sender = chooseMailSender({ ...base, APP_ENV: "local" }, { fetchImpl });
    await sender.send(message);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("mails whoever the message is for in production and ignores the allowlist", async () => {
    const fetchImpl = okFetch();
    const sender = chooseMailSender(
      { ...base, APP_ENV: "production", MAIL_DEV_ALLOWLIST: "someone-else@example.test" },
      { fetchImpl },
    );
    await sender.send(message);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toMatchObject({
      from: "no-reply@mail.example.test",
      to: ["tester@example.test"],
      reply_to: "support@mail.example.test",
    });
  });

  it("mails only the allowlist in dev and staging", async () => {
    for (const APP_ENV of ["dev", "staging"] as const) {
      const fetchImpl = okFetch();
      const onSkip = vi.fn();
      const sender = chooseMailSender(
        { ...base, APP_ENV, MAIL_DEV_ALLOWLIST: "tester@example.test" },
        { fetchImpl, onSkip },
      );
      await sender.send(message);
      await sender.send({ ...message, to: "stranger@example.test" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(onSkip).toHaveBeenCalledTimes(1);
    }
  });

  it("mails nobody in dev when the allowlist is empty", async () => {
    const fetchImpl = okFetch();
    const sender = chooseMailSender({ ...base, APP_ENV: "dev" }, { fetchImpl });
    await sender.send(message);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
