import { beforeEach, describe, expect, it, vi } from "vitest";
import { readRequestId, requestIdHeaders } from "@/server/request-id";

const createServerClient = vi.fn();
vi.mock("@supabase/ssr", () => ({
  createServerClient: (...parameters: unknown[]) => createServerClient(...parameters) as unknown,
}));
const incomingHeaders = new Headers();
vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve({ getAll: () => [], set: () => undefined }),
  headers: () => Promise.resolve(incomingHeaders),
}));

describe("UT-request-id", () => {
  it("accepts an id of the expected shape and nothing else", () => {
    expect(readRequestId(new Headers({ "x-request-id": "req-12345678" }))).toBe("req-12345678");
    expect(readRequestId(new Headers({ "x-request-id": "short" }))).toBeUndefined();
    expect(readRequestId(new Headers({ "x-request-id": "has spaces in it!" }))).toBeUndefined();
    expect(readRequestId(new Headers())).toBeUndefined();
  });

  it("builds the header only for a valid id", () => {
    expect(requestIdHeaders("req-12345678")).toEqual({ "x-request-id": "req-12345678" });
    expect(requestIdHeaders("bad id")).toEqual({});
    expect(requestIdHeaders(undefined)).toEqual({});
  });
});

describe("UT-request-id: the per-request Supabase client", () => {
  beforeEach(() => {
    createServerClient.mockReset();
    incomingHeaders.delete("x-request-id");
  });

  it("sends the request id to Supabase so audit entries can name the request", async () => {
    incomingHeaders.set("x-request-id", "req-12345678");
    const { createServerSupabase } = await import("@/server/supabase/server");
    await createServerSupabase();
    const options = createServerClient.mock.calls[0]?.[2] as { global: { headers: unknown } };
    expect(options.global.headers).toEqual({ "x-request-id": "req-12345678" });
  });

  it("sends no header when the request has no valid id", async () => {
    const { createServerSupabase } = await import("@/server/supabase/server");
    await createServerSupabase();
    const options = createServerClient.mock.calls[0]?.[2] as { global: { headers: unknown } };
    expect(options.global.headers).toEqual({});
  });
});
