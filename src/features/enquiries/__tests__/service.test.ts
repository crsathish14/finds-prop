import { beforeEach, describe, expect, it, vi } from "vitest";
import { mapEnquiryWriteError } from "../enquiry-service";

const rpc = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/admin.server", () => ({ createAdminSupabase: () => ({ rpc }) }));

const { createEnquiryWriteStore } = await import("../service");

const ROW = {
  shortId: "k3x9a2bd",
  userId: "user-1",
  name: "Priya Raman",
  phone: "919840012345",
  email: null,
  message: null,
};

beforeEach(() => vi.clearAllMocks());

describe("UT-enquiry-service: the database store (S5-T03)", () => {
  it("calls submit_enquiry with only the values given, and returns the new id", async () => {
    rpc.mockResolvedValue({ data: "enquiry-uuid", error: null });
    const id = await createEnquiryWriteStore("req-1").insertEnquiry({
      ...ROW,
      email: "priya@example.com",
      message: "Is it available?",
    });
    expect(id).toBe("enquiry-uuid");
    expect(rpc).toHaveBeenCalledWith("submit_enquiry", {
      p_short_id: "k3x9a2bd",
      p_user_id: "user-1",
      p_name: "Priya Raman",
      p_phone: "919840012345",
      p_email: "priya@example.com",
      p_message: "Is it available?",
    });
  });

  it("leaves the email and message out of the call when they were not given", async () => {
    rpc.mockResolvedValue({ data: "enquiry-uuid", error: null });
    await createEnquiryWriteStore("req-1").insertEnquiry(ROW);
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_email");
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_message");
  });

  it("turns a database error into the closed set of action errors", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "enquiry.duplicate" } });
    await expect(createEnquiryWriteStore("req-1").insertEnquiry(ROW)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("treats an answer that is not an id as a failure", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(createEnquiryWriteStore("req-1").insertEnquiry(ROW)).rejects.toMatchObject({
      code: "INTERNAL",
    });
  });
});

describe("mapEnquiryWriteError: what submit_enquiry raises", () => {
  it.each([
    [{ code: "P0002", message: "enquiry.property_not_found" }, "NOT_FOUND"],
    [{ code: "23505", message: "enquiry.duplicate" }, "CONFLICT"],
    [{ code: "42501", message: "enquiry.own_listing" }, "FORBIDDEN"],
    [{ code: "23514", message: "violates check constraint" }, "VALIDATION"],
    [{ code: "22023", message: "enquiry.user" }, "INTERNAL"],
    [{ code: "23505", message: "some other unique constraint" }, "INTERNAL"],
    [{ code: "42501", message: "permission denied" }, "INTERNAL"],
    [{}, "INTERNAL"],
  ])("maps %j to %s", (failure, code) => {
    expect(mapEnquiryWriteError(failure).code).toBe(code);
  });
});
