import { beforeEach, describe, expect, it, vi } from "vitest";

// UT-places-route (ADR-133): the route composes only. It reads the region from the site settings, counts the call
// against the `places` limits for an anonymous caller, picks the provider with the server configuration, and
// hands everything to the handler. No network, no Supabase, no real key.

const environment = vi.hoisted(
  () =>
    ({ APP_ENV: "local", PLACES_DISABLED: false }) as {
      APP_ENV: string;
      PLACES_DISABLED: boolean;
      OLA_MAPS_API_KEY?: string;
    },
);
const enforceActionRateLimit = vi.hoisted(() => vi.fn());
const getSiteSettings = vi.hoisted(() => vi.fn());
const reportError = vi.hoisted(() => vi.fn());
vi.mock("@/server/env", () => ({ env: environment }));
vi.mock("@/server/rate-limit/rate-limit", () => ({ enforceActionRateLimit }));
vi.mock("@/features/site", () => ({ getSiteSettings }));
vi.mock("@/server/observability", () => ({ reportError }));
// `after` keeps the callbacks, as the framework does, and runs them only when a test says the response is finished.
const scheduled = vi.hoisted(() => [] as Array<() => unknown>);
const writePlacesUsage = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({
  connection: vi.fn(async () => undefined),
  after: vi.fn((callback: () => unknown) => void scheduled.push(callback)),
}));
vi.mock("@/server/audit/places-usage", () => ({ writePlacesUsage }));

const route = await import("../route");

const BOUNDS = { south: 8.0, north: 13.6, west: 76.2, east: 80.4 };

function request(address: string, headers: Record<string, string> = {}) {
  return new Request(`https://example.test${address}`, { headers });
}

beforeEach(() => {
  environment.APP_ENV = "local";
  environment.PLACES_DISABLED = false;
  delete environment.OLA_MAPS_API_KEY;
  enforceActionRateLimit.mockReset().mockResolvedValue(undefined);
  getSiteSettings.mockReset().mockResolvedValue({ region: { bounds: BOUNDS } });
  reportError.mockReset().mockResolvedValue(undefined);
  writePlacesUsage.mockReset().mockResolvedValue(undefined);
  scheduled.length = 0;
});

/** Runs what the framework would run once the response is finished. */
async function finishResponse() {
  for (const callback of scheduled.splice(0)) await callback();
}

describe("UT-places-route: GET /api/places/autocomplete", () => {
  it("exports GET only, so every other method is refused by the framework", () => {
    expect(Object.keys(route)).toEqual(["GET"]);
  });

  it("answers local work with the fixed list when no key is set", async () => {
    const response = await route.GET(request("/api/places/autocomplete?q=velachery"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = (await response.json()) as { ok: boolean; data: Array<{ label: string }> };
    expect(body.ok).toBe(true);
    expect(body.data.map((place) => place.label)).toContain("Velachery");
  });

  it("counts the call against the places scope for an anonymous caller, with the request id", async () => {
    const response = await route.GET(
      request("/api/places/autocomplete?q=velachery", { "x-request-id": "req-from-proxy-01" }),
    );
    expect(enforceActionRateLimit).toHaveBeenCalledWith({
      scope: "places",
      session: null,
      requestId: "req-from-proxy-01",
    });
    expect(response.headers.get("x-request-id")).toBe("req-from-proxy-01");
  });

  it("makes a request id when the proxy sent none, and ignores one of the wrong shape", async () => {
    const response = await route.GET(
      request("/api/places/autocomplete?q=velachery", { "x-request-id": "no" }),
    );
    expect(response.headers.get("x-request-id")).toMatch(/^[\w-]{8,64}$/);
    expect(response.headers.get("x-request-id")).not.toBe("no");
  });

  it("reads the region from the site settings only after the input and the limit pass", async () => {
    await route.GET(request("/api/places/autocomplete?q=ab"));
    expect(enforceActionRateLimit).not.toHaveBeenCalled();
    expect(getSiteSettings).not.toHaveBeenCalled();
    await route.GET(request("/api/places/autocomplete?q=velachery"));
    expect(getSiteSettings).toHaveBeenCalledTimes(1);
  });

  it("answers 400 for text that is too short, without counting the call", async () => {
    const response = await route.GET(request("/api/places/autocomplete?q=ab"));
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("answers 429 when the limit is used up", async () => {
    const { RateLimitedError } = await import("@/server/rate-limit/enforce");
    enforceActionRateLimit.mockRejectedValue(new RateLimitedError("places", 12));
    const response = await route.GET(request("/api/places/autocomplete?q=velachery"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("12");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("answers 503 unavailable when the kill switch PLACES_DISABLED is on, even with a key set", async () => {
    environment.PLACES_DISABLED = true;
    environment.OLA_MAPS_API_KEY = "test-ola-key-do-not-leak";
    const response = await route.GET(request("/api/places/autocomplete?q=velachery"));
    const text = await response.text();
    expect(response.status).toBe(503);
    expect(JSON.parse(text)).toMatchObject({
      ok: false,
      code: "UPSTREAM_FAILED",
      reason: "unavailable",
    });
    expect(text).not.toContain("test-ola-key-do-not-leak");
  });

  it("answers 503 unavailable on production without a key (not configured is not an error)", async () => {
    environment.APP_ENV = "production";
    const response = await route.GET(request("/api/places/autocomplete?q=velachery"));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ reason: "unavailable" });
  });

  it("answers 500 unavailable, and tells the error tracker, when the settings cannot be read", async () => {
    getSiteSettings.mockRejectedValue(new Error("settings down"));
    const response = await route.GET(
      request("/api/places/autocomplete?q=velachery", { "x-request-id": "req-from-proxy-02" }),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ code: "INTERNAL", reason: "unavailable" });
    expect(reportError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ route: "places-autocomplete", requestId: "req-from-proxy-02" }),
    );
  });

  it("calls Ola with the key only in the request address, and never returns it", async () => {
    environment.OLA_MAPS_API_KEY = "test-ola-key-do-not-leak";
    const addresses: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        addresses.push(String(input));
        return Response.json({ status: "ok", predictions: [] });
      }),
    );
    try {
      const response = await route.GET(request("/api/places/autocomplete?q=velachery"));
      const text = await response.text();
      expect(response.status).toBe(200);
      expect(text).not.toContain("test-ola-key-do-not-leak");
      expect(addresses).toHaveLength(1);
      expect(addresses[0]).toContain("test-ola-key-do-not-leak");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// UT-places-usage-route (ADR-133 update, ADR-134): a call that reaches Ola is counted after the answer, through
// `after()`, and never before it. Ola is a stub `fetch`: no network, no real key, no database.
describe("UT-places-usage-route: counting after the response", () => {
  const OLA_PREDICTION = {
    place_id: "ola-1",
    description: "Velachery, Chennai, Tamil Nadu, India",
    structured_formatting: { main_text: "Velachery", secondary_text: "Chennai, Tamil Nadu, India" },
    types: ["sublocality"],
    geometry: { location: { lat: 12.97, lng: 80.22 } },
  };

  function stubOla(answer: () => Response | Promise<Response>) {
    const send = vi.fn(async () => answer());
    vi.stubGlobal("fetch", send);
    return send;
  }

  beforeEach(() => {
    environment.OLA_MAPS_API_KEY = "test-ola-key-do-not-leak";
  });

  it("answers first and writes the count later: nothing is written until the response is finished", async () => {
    stubOla(() => Response.json({ status: "ok", predictions: [OLA_PREDICTION] }));
    try {
      const response = await route.GET(
        request("/api/places/autocomplete?q=velachery", { "x-request-id": "req-from-proxy-03" }),
      );
      expect(response.status).toBe(200);
      expect(scheduled).toHaveLength(1);
      expect(writePlacesUsage).not.toHaveBeenCalled();
      await finishResponse();
      expect(writePlacesUsage).toHaveBeenCalledTimes(1);
      expect(writePlacesUsage).toHaveBeenCalledWith(
        { api: "autocomplete", caller: "search_box", outcome: "ok" },
        "req-from-proxy-03",
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("counts an empty answer from Ola as empty, with the source from the address", async () => {
    stubOla(() => Response.json({ status: "ok", predictions: [] }));
    try {
      const response = await route.GET(
        request("/api/places/autocomplete?q=velachery&source=listing_form"),
      );
      expect(await response.json()).toEqual({ ok: true, data: [] });
      await finishResponse();
      expect(writePlacesUsage).toHaveBeenCalledWith(
        { api: "autocomplete", caller: "listing_form", outcome: "empty" },
        expect.any(String),
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("counts a timeout, a quota refusal and an error from Ola with their own outcome", async () => {
    const cases: Array<[() => Response | Promise<Response>, string, number]> = [
      [() => Promise.reject(new DOMException("aborted", "AbortError")), "timeout", 502],
      [() => new Response("{}", { status: 429 }), "quota", 503],
      [() => new Response("{}", { status: 500 }), "error", 502],
    ];
    for (const [answer, outcome, status] of cases) {
      stubOla(answer);
      try {
        const response = await route.GET(request("/api/places/autocomplete?q=velachery"));
        expect(response.status).toBe(status);
        await finishResponse();
        expect(writePlacesUsage).toHaveBeenLastCalledWith(
          { api: "autocomplete", caller: "search_box", outcome },
          expect.any(String),
        );
      } finally {
        vi.unstubAllGlobals();
      }
    }
    expect(writePlacesUsage).toHaveBeenCalledTimes(3);
  });

  it("does not count a request that failed validation, was refused by our own limit, or hit the kill switch", async () => {
    stubOla(() => Response.json({ status: "ok", predictions: [] }));
    try {
      await route.GET(request("/api/places/autocomplete?q=ab"));
      await route.GET(request("/api/places/autocomplete?q=velachery&source=ai_chat"));
      const { RateLimitedError } = await import("@/server/rate-limit/enforce");
      enforceActionRateLimit.mockRejectedValueOnce(new RateLimitedError("places", 12));
      expect((await route.GET(request("/api/places/autocomplete?q=velachery"))).status).toBe(429);
      environment.PLACES_DISABLED = true;
      expect((await route.GET(request("/api/places/autocomplete?q=velachery"))).status).toBe(503);
      expect(scheduled).toHaveLength(0);
      await finishResponse();
      expect(writePlacesUsage).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not count the fixed local list or an unconfigured production: nothing reaches Ola", async () => {
    delete environment.OLA_MAPS_API_KEY;
    expect((await route.GET(request("/api/places/autocomplete?q=velachery"))).status).toBe(200);
    environment.APP_ENV = "production";
    expect((await route.GET(request("/api/places/autocomplete?q=velachery"))).status).toBe(503);
    expect(scheduled).toHaveLength(0);
    await finishResponse();
    expect(writePlacesUsage).not.toHaveBeenCalled();
  });

  it("keeps the answer and its shape when the write fails later", async () => {
    stubOla(() => Response.json({ status: "ok", predictions: [OLA_PREDICTION] }));
    writePlacesUsage.mockRejectedValue(new Error("database down"));
    try {
      const response = await route.GET(request("/api/places/autocomplete?q=velachery"));
      const body = (await response.json()) as { ok: boolean; data: Array<{ label: string }> };
      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data.map((place) => place.label)).toEqual(["Velachery"]);
      expect(Object.keys(body).sort()).toEqual(["data", "ok"]);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("keeps the answer when `after` itself cannot be used", async () => {
    stubOla(() => Response.json({ status: "ok", predictions: [OLA_PREDICTION] }));
    const { after } = await import("next/server");
    vi.mocked(after).mockImplementationOnce(() => {
      throw new Error("after was called outside a request scope");
    });
    try {
      const response = await route.GET(request("/api/places/autocomplete?q=velachery"));
      expect(response.status).toBe(200);
      expect((await response.json()) as { ok: boolean }).toMatchObject({ ok: true });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
