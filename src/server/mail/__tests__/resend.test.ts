import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { createResendSender } from "../resend";

const options = {
  apiKey: "fake-resend-key-for-tests",
  from: "no-reply@mail.example.test",
  replyTo: "support@mail.example.test",
};
const message = {
  to: "owner@example.test",
  subject: "Someone asked about your home",
  text: "Open your dashboard to read it.",
};

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

describe("UT-resend: the adapter (R-BE-09, ADR-181)", () => {
  it("sends one HTTPS POST with the key in the header and the sender, recipient, subject, text and reply-to in the body", async () => {
    const fetchImpl = fetchAnswering(Response.json({ id: "mail-1" }, { status: 200 }));
    await createResendSender({ ...options, fetchImpl }).send(message);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [address, init] = fetchImpl.mock.calls[0] ?? [];
    expect(address).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(init?.redirect).toBe("error");
    expect(init?.headers).toEqual({
      authorization: "Bearer fake-resend-key-for-tests",
      "content-type": "application/json",
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      from: "no-reply@mail.example.test",
      to: ["owner@example.test"],
      subject: "Someone asked about your home",
      text: "Open your dashboard to read it.",
      reply_to: "support@mail.example.test",
    });
  });

  it("leaves the reply-to out when none is set", async () => {
    const fetchImpl = fetchAnswering(Response.json({ id: "mail-1" }));
    await createResendSender({ apiKey: options.apiKey, from: options.from, fetchImpl }).send(
      message,
    );
    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).not.toHaveProperty("reply_to");
  });

  it("fails with UPSTREAM_FAILED and the status when the service refuses, repeating only a short error name", async () => {
    const fetchImpl = fetchAnswering(
      Response.json(
        { name: "daily_quota_exceeded", message: "owner@example.test is over the limit" },
        { status: 429 },
      ),
    );
    const refusal = await failure(createResendSender({ ...options, fetchImpl }).send(message));
    expect(refusal.code).toBe("UPSTREAM_FAILED");
    expect(refusal.message).toBe(
      "The mail provider refused the message (HTTP 429, daily_quota_exceeded)",
    );
  });

  it("says only the status when the error body is not JSON or the name has another shape", async () => {
    for (const body of [
      "<html>oops owner@example.test</html>",
      JSON.stringify({ name: "Bad Name!" }),
    ]) {
      const fetchImpl = fetchAnswering(new Response(body, { status: 422 }));
      const refusal = await failure(createResendSender({ ...options, fetchImpl }).send(message));
      expect(refusal.message).toBe("The mail provider refused the message (HTTP 422)");
    }
  });

  it("fails with UPSTREAM_FAILED when the network fails, without repeating the cause", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(
        new Error("connect failed for owner@example.test with fake-resend-key-for-tests"),
      );
    const refusal = await failure(createResendSender({ ...options, fetchImpl }).send(message));
    expect(refusal.code).toBe("UPSTREAM_FAILED");
    expect(refusal.message).toBe("The mail provider did not answer in time");
  });

  it("gives up after the time limit", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>(
        (_address, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      );
      const pending = failure(createResendSender({ ...options, fetchImpl }).send(message));
      await vi.advanceTimersByTimeAsync(3000);
      const refusal = await pending;
      expect(refusal.code).toBe("UPSTREAM_FAILED");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never puts the key, the address, the subject or the text in an error", async () => {
    const fetchImpl = fetchAnswering(
      Response.json(
        { name: "validation_error", message: "bad to owner@example.test" },
        { status: 422 },
      ),
    );
    const refusal = await failure(createResendSender({ ...options, fetchImpl }).send(message));
    for (const secret of [options.apiKey, message.to, message.subject, message.text]) {
      expect(refusal.message).not.toContain(secret);
    }
  });
});
