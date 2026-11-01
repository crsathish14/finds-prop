import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  enforceRateLimit,
  type RateLimitCaller,
  type RateLimitCounter,
} from "@/server/rate-limit/enforce";

function counterThatAllows(allowed = true, retryAfter = 0) {
  const hit = vi.fn().mockResolvedValue({ allowed, retryAfter });
  return { counter: { hit } satisfies RateLimitCounter, hit };
}

const caller: RateLimitCaller = {
  userId: "user-1",
  visitor: () => "visitor-hash",
  ip: () => "ip-hash",
  hashKey: (key) => `hashed(${key})`,
};

async function failure(run: Promise<void>): Promise<ActionError> {
  try {
    await run;
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected a refusal");
}

describe("UT-rate-limit: enforceRateLimit", () => {
  it("counts a visitor limit with the visitor hash", async () => {
    const { counter, hit } = counterThatAllows();
    await enforceRateLimit({ counter, scope: "project_lead", caller });
    expect(hit).toHaveBeenCalledWith("project_lead_visitor", "visitor-hash", 3600, 5);
  });

  it("counts a user limit with the user id", async () => {
    const { counter, hit } = counterThatAllows();
    await enforceRateLimit({ counter, scope: "enquiry", caller });
    expect(hit).toHaveBeenCalledWith("enquiry_user", "user-1", 86400, 10);
  });

  it("counts one visitor on one form: visitor hash joined with the hashed key", async () => {
    const { counter, hit } = counterThatAllows();
    await enforceRateLimit({ counter, scope: "form_submit", caller, key: "contact" });
    expect(hit).toHaveBeenCalledWith(
      "form_submit_visitor_key",
      "visitor-hash:hashed(contact)",
      3600,
      5,
    );
  });

  it("counts a phone code per phone and per address, and never hands the phone over unhashed", async () => {
    const { counter, hit } = counterThatAllows();
    await enforceRateLimit({ counter, scope: "otp_request", caller, key: "+919000000001" });
    expect(hit).toHaveBeenNthCalledWith(1, "otp_request_key", "hashed(+919000000001)", 3600, 5);
    expect(hit).toHaveBeenNthCalledWith(2, "otp_request_ip", "ip-hash", 86400, 20);
    for (const call of hit.mock.calls) expect(String(call[1])).not.toBe("+919000000001");
  });

  it("refuses with RATE_LIMITED and the seconds to wait", async () => {
    const { counter } = counterThatAllows(false, 1500);
    const refusal = await failure(enforceRateLimit({ counter, scope: "places", caller }));
    expect(refusal.code).toBe("RATE_LIMITED");
    expect(refusal.retryAfter).toBe(1500);
  });

  it("stops at the first rule that is over its limit", async () => {
    const hit = vi
      .fn()
      .mockResolvedValueOnce({ allowed: false, retryAfter: 900 })
      .mockResolvedValue({ allowed: true, retryAfter: 0 });
    const refusal = await failure(
      enforceRateLimit({ counter: { hit }, scope: "otp_request", caller, key: "+919000000001" }),
    );
    expect(refusal.retryAfter).toBe(900);
    expect(hit).toHaveBeenCalledTimes(1);
  });

  it("refuses the call when the counter itself fails (fail closed)", async () => {
    const hit = vi.fn().mockRejectedValue(new ActionError("INTERNAL", "counter down"));
    const refusal = await failure(enforceRateLimit({ counter: { hit }, scope: "places", caller }));
    expect(refusal.code).toBe("INTERNAL");
  });

  it("is a configuration error, not a pass, when a limit needs something it was not given", async () => {
    const { counter, hit } = counterThatAllows();
    expect((await failure(enforceRateLimit({ counter, scope: "form_submit", caller }))).code).toBe(
      "INTERNAL",
    );
    expect(
      (
        await failure(
          enforceRateLimit({ counter, scope: "enquiry", caller: { ...caller, userId: null } }),
        )
      ).code,
    ).toBe("INTERNAL");
    expect(hit).not.toHaveBeenCalled();
  });

  it("does not need the hash secret for a limit counted by user id", async () => {
    const { counter } = counterThatAllows();
    const secretless: RateLimitCaller = {
      userId: "user-1",
      visitor: () => {
        throw new Error("the visitor hash was computed");
      },
      ip: () => {
        throw new Error("the ip hash was computed");
      },
      hashKey: () => {
        throw new Error("a key hash was computed");
      },
    };
    await expect(
      enforceRateLimit({ counter, scope: "enquiry", caller: secretless }),
    ).resolves.toBeUndefined();
  });
});
