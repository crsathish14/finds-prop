import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { sendFeedbackConfig, setFeedbackReviewedConfig } from "../action-config";
import { markFeedbackReviewed, mapFeedbackError, sendFeedback } from "../feedback-service";
import { feedbackFilterSchema, sendFeedbackSchema, setFeedbackReviewedSchema } from "../schemas";
import { toFeedbackViews } from "../view";

const ID = "00000000-0000-4000-b000-000000000001";

describe("UT-feedback: the message", () => {
  it("trims the text and keeps new lines", () => {
    expect(sendFeedbackSchema.parse({ message: "  Hello\nthere  " })).toEqual({
      message: "Hello\nthere",
    });
  });

  it("refuses an empty message, one over 1000 characters and control characters", () => {
    expect(sendFeedbackSchema.safeParse({ message: "   " }).success).toBe(false);
    expect(sendFeedbackSchema.safeParse({ message: "a".repeat(1000) }).success).toBe(true);
    expect(sendFeedbackSchema.safeParse({ message: "a".repeat(1001) }).success).toBe(false);
    expect(sendFeedbackSchema.safeParse({ message: "bad\u0007text" }).success).toBe(false);
    expect(sendFeedbackSchema.safeParse({}).success).toBe(false);
  });

  it("takes only a real id and a yes or no for the flag", () => {
    expect(setFeedbackReviewedSchema.safeParse({ feedbackId: ID, reviewed: true }).success).toBe(
      true,
    );
    expect(setFeedbackReviewedSchema.safeParse({ feedbackId: "x", reviewed: true }).success).toBe(
      false,
    );
    expect(setFeedbackReviewedSchema.safeParse({ feedbackId: ID, reviewed: "yes" }).success).toBe(
      false,
    );
  });
});

describe("UT-feedback: the filters", () => {
  it("defaults to not reviewed, page 1, and drops what is not valid", () => {
    expect(feedbackFilterSchema.parse({})).toEqual({ state: "open", page: 1 });
    expect(feedbackFilterSchema.parse({ state: "reviewed", page: "3" })).toEqual({
      state: "reviewed",
      page: 3,
    });
    expect(feedbackFilterSchema.parse({ state: "nope", page: "-4" })).toEqual({
      state: "open",
      page: 1,
    });
  });
});

describe("UT-feedback: the rules", () => {
  it("sends through the store and reports a missing message as not found", async () => {
    const store = {
      send: (message: string) => Promise.resolve(`id-for-${message}`),
      setReviewed: () => Promise.resolve(false),
    };
    expect(await sendFeedback(store, { message: "Hi" })).toEqual({ feedbackId: "id-for-Hi" });
    await expect(
      markFeedbackReviewed(store, { feedbackId: ID, reviewed: true }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const found = { ...store, setReviewed: () => Promise.resolve(true) };
    expect(await markFeedbackReviewed(found, { feedbackId: ID, reviewed: false })).toEqual({
      feedbackId: ID,
      reviewed: false,
    });
  });

  it("maps what the database raises", () => {
    expect(mapFeedbackError({ code: "42501" })).toBeInstanceOf(ActionError);
    expect(mapFeedbackError({ code: "42501" }).code).toBe("FORBIDDEN");
    expect(mapFeedbackError({ message: "feedback.invalid_message" }).code).toBe("VALIDATION");
    expect(mapFeedbackError({}).code).toBe("INTERNAL");
  });

  it("limits and gates the two actions", () => {
    expect(sendFeedbackConfig.auth.role).toBe("builder");
    expect(sendFeedbackConfig.rateLimit.scope).toBe("builder_feedback");
    expect(setFeedbackReviewedConfig.auth.role).toBe("super_admin");
    expect(setFeedbackReviewedConfig.rateLimit.scope).toBe("admin_edit");
  });

  it("shows an unknown kind as a builder", () => {
    const [view] = toFeedbackViews([
      {
        id: ID,
        builder_id: ID,
        builder_name: "Nila",
        builder_kind: "agent",
        message: "x",
        created_at: "2026-11-22T10:00:00Z",
        reviewed_at: null,
      },
    ]);
    expect(view?.kind).toBe("agent");
  });
});
