import { describe, expect, it, vi } from "vitest";
import { createDefineAction, type ActionDeps } from "@/server/actions/define-action";
import { ActionError } from "@/server/actions/normalise-error";
import type { SessionView } from "@/server/auth/session";
import { createLogger } from "@/server/logger";
import { setEnquiryStatusConfig } from "../action-config";
import { setEnquiryStatusSchema } from "../schemas";
import { mapEnquiryStatusError, moveEnquiry, type EnquiryStatusStore } from "../status-service";

const ENQUIRY = "00000000-0000-4000-9000-0000000000e1";

const owner: SessionView = {
  userId: "00000000-0000-4000-8000-0000000000a1",
  roles: ["customer"],
  phoneVerified: true,
  builderId: null,
};

function harness(options: { session?: SessionView | null } = {}) {
  const calls: string[] = [];
  const deps: ActionDeps = {
    newRequestId: () => "req-1",
    getSession: () => Promise.resolve(options.session === undefined ? owner : options.session),
    rateLimit: ({ scope }) => {
      calls.push(`rateLimit:${scope}`);
      return Promise.resolve();
    },
    beginIdempotent: () => {
      calls.push("begin");
      return Promise.resolve({ replay: false as const });
    },
    completeIdempotent: () => Promise.resolve(),
    releaseIdempotent: () => Promise.resolve(),
    invalidate: (tags) => {
      calls.push(`invalidate:${tags.join("|")}`);
    },
    audit: () => {
      calls.push("audit");
      return Promise.resolve();
    },
    log: createLogger({}, { write: () => undefined }),
  };
  const move = createDefineAction(deps)({
    ...setEnquiryStatusConfig,
    handler: async () => {
      calls.push("handler");
      return { enquiryId: ENQUIRY, status: "contacted" as const };
    },
  });
  return { calls, move };
}

describe("UT-enquiry-status-schema: moving an enquiry forward (S6-T03)", () => {
  it.each(["contacted", "closed"] as const)("accepts %s", (status) => {
    expect(setEnquiryStatusSchema.safeParse({ enquiryId: ENQUIRY, status }).success).toBe(true);
  });

  it.each([
    {},
    { enquiryId: ENQUIRY },
    { enquiryId: ENQUIRY, status: "new" },
    { enquiryId: ENQUIRY, status: "open" },
    { enquiryId: "nope", status: "closed" },
    { status: "closed" },
  ])("refuses %j", (input) => {
    expect(setEnquiryStatusSchema.safeParse(input).success).toBe(false);
  });

  it("reads the id in lower case", () => {
    expect(
      setEnquiryStatusSchema.parse({ enquiryId: ENQUIRY.toUpperCase(), status: "closed" })
        .enquiryId,
    ).toBe(ENQUIRY);
  });
});

describe("UT-enquiry-status-action: who may move an enquiry (S6-T03)", () => {
  it("needs a verified phone and runs with no limit, key, cache refresh or audit entry", async () => {
    const { move, calls } = harness();
    expect((await move({ enquiryId: ENQUIRY, status: "contacted" })).ok).toBe(true);
    expect(calls).toEqual(["handler"]);
  });

  it.each([
    ["a visitor", null, "UNAUTHENTICATED"],
    ["an account with no verified phone", { ...owner, phoneVerified: false }, "FORBIDDEN"],
  ] as const)("refuses %s", async (_who, session, code) => {
    const { move, calls } = harness({ session });
    expect(await move({ enquiryId: ENQUIRY, status: "closed" })).toMatchObject({ ok: false, code });
    expect(calls).toEqual([]);
  });

  it("refuses a status that is not contacted or closed", async () => {
    const { move, calls } = harness();
    expect(await move({ enquiryId: ENQUIRY, status: "new" })).toMatchObject({
      ok: false,
      code: "VALIDATION",
    });
    expect(calls).toEqual([]);
  });
});

describe("UT-enquiry-status-service: the owner's move (S6-T03)", () => {
  it("changes the status and says which enquiry and where it went", async () => {
    const setStatus = vi.fn<EnquiryStatusStore["setStatus"]>().mockResolvedValue(true);
    expect(await moveEnquiry({ setStatus }, { enquiryId: ENQUIRY, status: "closed" })).toEqual({
      enquiryId: ENQUIRY,
      status: "closed",
    });
    expect(setStatus).toHaveBeenCalledWith(ENQUIRY, "closed");
  });

  it("answers not found when the caller cannot see that enquiry (not theirs, or not there)", async () => {
    await expect(
      moveEnquiry({ setStatus: async () => false }, { enquiryId: ENQUIRY, status: "closed" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it.each([
    [{ message: "enquiries.status_transition", code: "P0001" }, "CONFLICT"],
    [{ code: "42501" }, "FORBIDDEN"],
    [{ message: "something else", code: "XX000" }, "INTERNAL"],
    [{}, "INTERNAL"],
  ])("maps %j to %s", (failure, code) => {
    const error = mapEnquiryStatusError(failure);
    expect(error).toBeInstanceOf(ActionError);
    expect(error.code).toBe(code);
  });
});
