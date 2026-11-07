import { describe, expect, it, vi } from "vitest";
import { uploadToTarget } from "../upload-to-target";

const TARGET = {
  bucket: "listing-photos",
  path: "00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/00000000-0000-4000-8000-0000000000f1.webp",
  token: "one-time-token",
};
const BASE = "https://project.example.test";
const KEY = "publishable-placeholder";

describe("UT-upload-to-target: sending a prepared photo to its one-time address", () => {
  it("PUTs the file to the signed-upload address with the token, and keeps the slashes in the path", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    const file = new Blob(["picture"], { type: "image/webp" });
    await expect(
      uploadToTarget(TARGET, file, { baseUrl: BASE, apiKey: KEY, fetcher }),
    ).resolves.toEqual({ ok: true });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [address, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const url = new URL(address);
    expect(url.origin).toBe(BASE);
    expect(url.pathname).toBe(`/storage/v1/object/upload/sign/listing-photos/${TARGET.path}`);
    expect(url.searchParams.get("token")).toBe("one-time-token");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(file);
    expect(init.headers).toMatchObject({
      apikey: KEY,
      "content-type": "image/webp",
      "x-upsert": "false",
    });
  });

  it("sends no sign-in with the file: the token is the permission", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 200 }));
    await uploadToTarget(TARGET, new Blob(["x"], { type: "image/jpeg" }), {
      baseUrl: BASE,
      apiKey: KEY,
      fetcher,
    });
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    const names = Object.keys(init.headers as Record<string, string>).map((name) =>
      name.toLowerCase(),
    );
    expect(names).not.toContain("authorization");
    expect(init.credentials).toBeUndefined();
  });

  it("answers not ok when the storage service refuses", async () => {
    const fetcher = vi.fn(async () => new Response("{}", { status: 403 }));
    await expect(
      uploadToTarget(TARGET, new Blob(["x"], { type: "image/png" }), {
        baseUrl: BASE,
        apiKey: KEY,
        fetcher,
      }),
    ).resolves.toEqual({ ok: false });
  });

  it("answers not ok, and does not throw, when the network fails", async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError("network down");
    });
    await expect(
      uploadToTarget(TARGET, new Blob(["x"], { type: "image/png" }), {
        baseUrl: BASE,
        apiKey: KEY,
        fetcher,
      }),
    ).resolves.toEqual({ ok: false });
  });
});
