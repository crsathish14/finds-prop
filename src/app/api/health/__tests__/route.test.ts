import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ connection: async () => undefined }));

const settings = vi.hoisted(() => ({
  env: { VERCEL_GIT_COMMIT_SHA: undefined as string | undefined },
}));
vi.mock("@/server/env", () => settings);

import { GET } from "@/app/api/health/route";

describe("/api/health names the deployed commit for the release smoke check (ADR-201)", () => {
  beforeEach(() => {
    settings.env.VERCEL_GIT_COMMIT_SHA = undefined;
  });

  it("adds the commit when Vercel provides one", async () => {
    settings.env.VERCEL_GIT_COMMIT_SHA = "443cf1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4";
    const response = await GET();
    expect(await response.json()).toEqual({
      status: "ok",
      app: "findsprop",
      commit: "443cf1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("answers without a commit outside Vercel", async () => {
    const response = await GET();
    expect(await response.json()).toEqual({ status: "ok", app: "findsprop" });
  });
});
