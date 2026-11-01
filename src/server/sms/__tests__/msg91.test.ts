import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { createMsg91Sender } from "@/server/sms/msg91";

const options = { authKey: "test-authkey-value", templateId: "tmpl-0001" };
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

describe("UT-msg91: the adapter (R-BE-09)", () => {
  it("posts the Send OTP request with the template, the number and our own code", async () => {
    const fetchImpl = fetchAnswering(Response.json({ type: "success", message: "request-id" }));
    await createMsg91Sender({ ...options, fetchImpl }).sendOtp(message);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [address, init] = fetchImpl.mock.calls[0] ?? [];
    const url = new URL(String(address));
    expect(url.origin + url.pathname).toBe("https://control.msg91.com/api/v5/otp");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      template_id: "tmpl-0001",
      mobile: "919000000001",
      otp: "123456",
    });
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ authkey: "test-authkey-value" });
  });

  it("fails with UPSTREAM_FAILED on an HTTP error", async () => {
    const fetchImpl = fetchAnswering(new Response("no", { status: 500 }));
    const refusal = await failure(createMsg91Sender({ ...options, fetchImpl }).sendOtp(message));
    expect(refusal.code).toBe("UPSTREAM_FAILED");
  });

  it("fails when MSG91 answers 200 but says error, because the body decides", async () => {
    const fetchImpl = fetchAnswering(
      Response.json({ type: "error", message: "Template not found" }),
    );
    const refusal = await failure(createMsg91Sender({ ...options, fetchImpl }).sendOtp(message));
    expect(refusal.code).toBe("UPSTREAM_FAILED");
  });

  it("fails on an answer that is not JSON", async () => {
    const fetchImpl = fetchAnswering(new Response("<html>gateway</html>", { status: 200 }));
    const refusal = await failure(createMsg91Sender({ ...options, fetchImpl }).sendOtp(message));
    expect(refusal.code).toBe("UPSTREAM_FAILED");
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
      createMsg91Sender({ ...options, fetchImpl: slow, timeoutMs: 20 }).sendOtp(message),
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
      const pending = failure(createMsg91Sender({ ...options, fetchImpl: slow }).sendOtp(message));
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

  it("never puts the phone, the code or the key in an error", async () => {
    const answers = [
      fetchAnswering(new Response("no", { status: 502 })),
      fetchAnswering(Response.json({ type: "error", message: "bad 919000000001 123456" })),
      vi.fn<typeof fetch>().mockRejectedValue(new Error("connect to 919000000001 failed")),
    ];
    for (const fetchImpl of answers) {
      const refusal = await failure(createMsg91Sender({ ...options, fetchImpl }).sendOtp(message));
      for (const secret of ["919000000001", "123456", "test-authkey-value"]) {
        expect(refusal.message).not.toContain(secret);
      }
    }
  });
});
