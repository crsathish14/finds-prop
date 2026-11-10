import { afterEach, describe, expect, it, vi } from "vitest";
import { DUE, fakeFetch, fakeStore, type FakeOptions } from "./delivery-fixtures";

vi.mock("server-only", () => ({}));
const createDeliveryStore = vi.fn();
vi.mock("../service", () => ({
  createDeliveryStore: (...args: unknown[]) => createDeliveryStore(...args),
}));

const { deliverSubmissionNow } = await import("../deliver-now");

function arrange(options: FakeOptions, status = 200) {
  const made = fakeStore(options);
  createDeliveryStore.mockReturnValue(made.store);
  const { fetcher, sent } = fakeFetch(status, "ok");
  vi.stubGlobal("fetch", fetcher);
  return { ...made, sent };
}

afterEach(() => {
  vi.unstubAllGlobals();
  createDeliveryStore.mockReset();
});

describe("UT-crm-deliver-now: the send right after a form is stored (S7-T09 B2)", () => {
  it("claims the one submission by name and sends it, with the request id on the store", async () => {
    const { calls, sent } = arrange({ due: [DUE] });
    await deliverSubmissionNow(DUE.submissionId, "req-1");
    expect(createDeliveryStore).toHaveBeenCalledWith("req-1");
    expect(calls[0]).toBe(`claim:1:${DUE.submissionId}`);
    expect(sent).toHaveLength(1);
    expect(calls).not.toContain("arm");
  });

  it("ends quietly for a form with no CRM connection: nothing is claimed, nothing is sent", async () => {
    const { calls, sent } = arrange({ due: [] });
    await deliverSubmissionNow(DUE.submissionId, "req-1");
    expect(sent).toHaveLength(0);
    expect(calls).toEqual([`claim:1:${DUE.submissionId}`]);
  });

  it("arms the retry job when the send failed and a retry is waiting", async () => {
    const { calls } = arrange({ due: [DUE] }, 500);
    await deliverSubmissionNow(DUE.submissionId, "req-1");
    expect(calls).toContain("arm");
  });

  it("never throws: a claim that fails arms the job so the sweep takes the submission", async () => {
    const { calls } = arrange({ claimFails: true });
    await expect(deliverSubmissionNow(DUE.submissionId, "req-1")).resolves.toBeUndefined();
    expect(calls).toContain("arm");
  });

  it("never throws even when the job cannot be armed either", async () => {
    arrange({ claimFails: true, armFails: true });
    await expect(deliverSubmissionNow(DUE.submissionId, "req-1")).resolves.toBeUndefined();
  });

  it("never throws when the store cannot even be made", async () => {
    createDeliveryStore.mockImplementation(() => {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    });
    await expect(deliverSubmissionNow(DUE.submissionId, "req-1")).resolves.toBeUndefined();
  });
});
