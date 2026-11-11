import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { createPing4SmsSender } from "@/server/sms/ping4sms";

const options = {
  apiKey: "fake-api-key-for-tests",
  senderId: "TESTSM",
  templateId: "1000000000000000001",
  route: "2",
  message: "Your test code is {#var#}. Do not share it.",
};
const message = { phone: "919000000001", code: "123456" };

function fetchAnswering(response: Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response);
}

async function failure(run: Promise<void>): Promise<ActionError> {
  try {
    await run;
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the sender to fail");
}

describe("UT-ping4sms: the adapter (R-BE-09)", () => {
  it("sends one HTTPS GET with the key, route, sender, ten digit number, text and template", async () => {
    const fetchImpl = fetchAnswering(new Response("100000001", { status: 200 }));
    await createPing4SmsSender({ ...options, fetchImpl }).sendOtp(message);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [address, init] = fetchImpl.mock.calls[0] ?? [];
    const url = new URL(String(address));
    expect(url.origin + url.pathname).toBe("https://site.ping4sms.com/api/smsapi");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: "fake-api-key-for-tests",
      route: "2",
      sender: "TESTSM",
      number: "9000000001",
      sms: "Your test code is 123456. Do not share it.",
      templateid: "1000000000000000001",
    });
    expect(init?.method).toBe("GET");
    expect(init?.redirect).toBe("error");
  });

  it("counts a long number as the message id, with or without whitespace around it", async () => {
    for (const body of ["169365451", "169365451\n", " 100000001 "]) {
      const fetchImpl = fetchAnswering(new Response(body, { status: 200 }));
      await expect(
        createPing4SmsSender({ ...options, fetchImpl }).sendOtp(message),
      ).resolves.toBeUndefined();
    }
  });

  it("fails on the short error number the service answers with (101 was seen for a wrong key)", async () => {
    const fetchImpl = fetchAnswering(new Response("101", { status: 200 }));
    const refusal = await failure(createPing4SmsSender({ ...options, fetchImpl }).sendOtp(message));
    expect(refusal.code).toBe("UPSTREAM_FAILED");
    expect(refusal.message).toContain("code 101");
  });

  it("fails closed on anything that is not a message id", async () => {
    for (const body of ["", "Invalid user.", "<html>gateway</html>", '{"error":"x"}', "12345"]) {
      const fetchImpl = fetchAnswering(new Response(body, { status: 200 }));
      const refusal = await failure(
        createPing4SmsSender({ ...options, fetchImpl }).sendOtp(message),
      );
      expect(refusal.code).toBe("UPSTREAM_FAILED");
    }
  });

  it("fails with UPSTREAM_FAILED on an HTTP error, even when the body looks like an id", async () => {
    const fetchImpl = fetchAnswering(new Response("100000001", { status: 500 }));
    const refusal = await failure(createPing4SmsSender({ ...options, fetchImpl }).sendOtp(message));
    expect(refusal.code).toBe("UPSTREAM_FAILED");
  });

  it("refuses a number that is not an Indian mobile before calling the provider", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    for (const phone of ["14155550100", "915000000001", "9000000001", "91900000001"]) {
      const refusal = await failure(
        createPing4SmsSender({ ...options, fetchImpl }).sendOtp({ phone, code: "123456" }),
      );
      expect(refusal.code).toBe("UPSTREAM_FAILED");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("needs a template with exactly one place for the code", () => {
    for (const bad of ["Your code", "Code {#var#} and {#var#}"]) {
      expect(() => createPing4SmsSender({ ...options, message: bad })).toThrow(/not configured/);
    }
  });

  it("puts the code in as plain text, even if it looked like a replacement pattern", async () => {
    const fetchImpl = fetchAnswering(new Response("100000001", { status: 200 }));
    await createPing4SmsSender({ ...options, fetchImpl }).sendOtp({ ...message, code: "$&$&$&" });
    const [address] = fetchImpl.mock.calls[0] ?? [];
    expect(new URL(String(address)).searchParams.get("sms")).toBe(
      "Your test code is $&$&$&. Do not share it.",
    );
  });

  it("gives up when the provider is too slow, so the 5 second hook budget holds", async () => {
    const slow = vi.fn<typeof fetch>().mockImplementation(
      (_address, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const started = Date.now();
    const refusal = await failure(
      createPing4SmsSender({ ...options, fetchImpl: slow, timeoutMs: 20 }).sendOtp(message),
    );
    expect(refusal.code).toBe("UPSTREAM_FAILED");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("allows 3 seconds by default", async () => {
    vi.useFakeTimers();
    try {
      const slow = vi.fn<typeof fetch>().mockImplementation(
        (_address, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      );
      const pending = failure(
        createPing4SmsSender({ ...options, fetchImpl: slow }).sendOtp(message),
      );
      await vi.advanceTimersByTimeAsync(2999);
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect((await pending).code).toBe("UPSTREAM_FAILED");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never puts the phone, the code, the key or the text in an error", async () => {
    const answers = [
      fetchAnswering(new Response("no", { status: 502 })),
      fetchAnswering(new Response("bad 9000000001 123456 fake-api-key-for-tests", { status: 200 })),
      fetchAnswering(new Response("101", { status: 200 })),
      vi
        .fn<typeof fetch>()
        .mockRejectedValue(new Error("connect to site.ping4sms.com?key=fake-api-key-for-tests")),
    ];
    for (const fetchImpl of answers) {
      const refusal = await failure(
        createPing4SmsSender({ ...options, fetchImpl }).sendOtp(message),
      );
      for (const secret of [
        "919000000001",
        "9000000001",
        "123456",
        "fake-api-key-for-tests",
        "Your test code",
      ]) {
        expect(refusal.message).not.toContain(secret);
      }
    }
  });
});
