import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "@/types/action";
import { aiFailureFromHttpStatus, aiFailureFromThrown, describeAiFailure } from "../errors";
import { AI_ERROR_KINDS } from "../types";

describe("UT-ai-errors: provider failures become our closed ErrorCode set (ADR-128 4.4, R-BE-05)", () => {
  it("maps every failure kind to a code that is in the closed set", () => {
    for (const kind of AI_ERROR_KINDS) {
      expect(ERROR_CODES).toContain(describeAiFailure(kind).code);
    }
  });

  it("maps each kind to the agreed code", () => {
    expect(describeAiFailure("rate_limited").code).toBe("RATE_LIMITED");
    expect(describeAiFailure("timeout").code).toBe("UPSTREAM_FAILED");
    expect(describeAiFailure("unavailable").code).toBe("UPSTREAM_FAILED");
    expect(describeAiFailure("interrupted").code).toBe("UPSTREAM_FAILED");
    expect(describeAiFailure("refused").code).toBe("UPSTREAM_FAILED");
    expect(describeAiFailure("rejected").code).toBe("INTERNAL");
  });

  it("marks only timeout, unavailable and interrupted as worth one retry", () => {
    const transient = AI_ERROR_KINDS.filter((kind) => describeAiFailure(kind).transient);
    expect(transient).toEqual(["timeout", "unavailable", "interrupted"]);
  });

  it("never hands a customer a code that says they lack permission", () => {
    for (const kind of AI_ERROR_KINDS) {
      expect(["FORBIDDEN", "UNAUTHENTICATED"]).not.toContain(describeAiFailure(kind).code);
    }
  });

  it("carries data only: a failure has a kind, a code and a flag, never provider text", () => {
    for (const kind of AI_ERROR_KINDS) {
      expect(Object.keys(describeAiFailure(kind)).sort()).toEqual(["code", "kind", "transient"]);
    }
  });

  describe("from an HTTP status", () => {
    it.each([
      [429, "rate_limited"],
      [408, "timeout"],
      [504, "timeout"],
      [500, "unavailable"],
      [502, "unavailable"],
      [503, "unavailable"],
      [529, "unavailable"],
      [400, "rejected"],
      [401, "rejected"],
      [403, "rejected"],
      [404, "rejected"],
      [422, "rejected"],
    ])("status %i is %s", (status, kind) => {
      expect(aiFailureFromHttpStatus(status).kind).toBe(kind);
    });
  });

  describe("from something an adapter caught", () => {
    it("treats a timeout or an abort as a timeout", () => {
      expect(aiFailureFromThrown(new DOMException("too slow", "TimeoutError")).kind).toBe(
        "timeout",
      );
      expect(aiFailureFromThrown(new DOMException("stopped", "AbortError")).kind).toBe("timeout");
    });

    it("treats a network failure (fetch rejects with a TypeError) as unavailable", () => {
      expect(aiFailureFromThrown(new TypeError("fetch failed")).kind).toBe("unavailable");
    });

    it("reads a numeric status, as the official SDK errors carry", () => {
      expect(aiFailureFromThrown(Object.assign(new Error("slow down"), { status: 429 })).kind).toBe(
        "rate_limited",
      );
      expect(aiFailureFromThrown(Object.assign(new Error("boom"), { status: 503 })).kind).toBe(
        "unavailable",
      );
    });

    it("treats anything unknown as ours to fix (rejected), never as a provider outage", () => {
      expect(aiFailureFromThrown(new Error("something odd")).kind).toBe("rejected");
      expect(aiFailureFromThrown("a string").kind).toBe("rejected");
      expect(aiFailureFromThrown(undefined).kind).toBe("rejected");
    });

    it("never copies the provider's message into the failure", () => {
      const failure = aiFailureFromThrown(
        Object.assign(new Error("secret key sk-123 is invalid"), { status: 401 }),
      );
      expect(JSON.stringify(failure)).not.toContain("sk-123");
    });
  });
});
