import { describe, expect, it, vi } from "vitest";
import { ActionError } from "../../actions/normalise-error";
import type { PlacesUsageRecord } from "../../audit/places-usage";
import { createLogger } from "../../logger";
import { RateLimitedError } from "../../rate-limit/enforce";
import { createOffPlaceProvider } from "../fake";
import {
  createFakePlaceProvider,
  FAKE_PLACES,
  handlePlaceAutocomplete,
  PlaceLookupError,
  type PlaceAutocompleteDeps,
  type PlaceFailure,
  type PlaceProvider,
} from "@/server/places";
import type { PlaceAutocompleteResult } from "@/types/places";

// UT-places-autocomplete (ADR-133, FR-GEO-01 criteria 1 to 5): the handler behind GET /api/places/autocomplete. No
// network and no real key: every provider here is the fake, the off provider or a stub that throws.

const REQUEST_ID = "req-places-0001";
const TYPED = "Zanzibar Quarter Secret";
const KEY = "test-ola-key-do-not-leak";

function setup(overrides: Partial<PlaceAutocompleteDeps> = {}) {
  const lines: string[] = [];
  const reportError = vi.fn(async () => undefined);
  const enforceLimits = vi.fn(async () => undefined);
  const recorded: PlacesUsageRecord[] = [];
  const recordUsage = vi.fn((record: PlacesUsageRecord) => void recorded.push(record));
  const fake = createFakePlaceProvider();
  const deps: PlaceAutocompleteDeps = {
    requestId: REQUEST_ID,
    enforceLimits,
    getProvider: () => fake,
    log: createLogger(
      { requestId: REQUEST_ID },
      { level: "debug", write: (line) => lines.push(line) },
    ),
    reportError,
    recordUsage,
    ...overrides,
  };
  return { deps, lines, reportError, enforceLimits, fake, recorded, recordUsage };
}

async function call(query: string | null, deps: PlaceAutocompleteDeps, raw?: string) {
  const address =
    raw ??
    (query === null
      ? "/api/places/autocomplete"
      : `/api/places/autocomplete?q=${encodeURIComponent(query)}`);
  const response = await handlePlaceAutocomplete(
    new Request(`https://example.test${address}`),
    deps,
  );
  const text = await response.text();
  return { response, text, body: JSON.parse(text) as PlaceAutocompleteResult };
}

function providerThatFails(failure: PlaceFailure): PlaceProvider {
  return {
    autocomplete: () =>
      Promise.reject(new PlaceLookupError(failure, `Lookup failed: ${failure} for ${KEY}`)),
  };
}

describe("UT-places-autocomplete: success", () => {
  it("answers 200 with the suggestions, each with exactly the six fields the box needs", async () => {
    const { deps, fake } = setup();
    const { response, body } = await call("kk nagar", deps);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    if (!body.ok) return;
    expect(body.data.length).toBeGreaterThan(0);
    for (const suggestion of body.data) {
      expect(Object.keys(suggestion).sort()).toEqual([
        "detail",
        "id",
        "kind",
        "label",
        "lat",
        "lng",
      ]);
    }
    expect(body.data[0]).toEqual(FAKE_PLACES[0]);
    expect(fake.asked).toEqual(["kk nagar"]);
  });

  it("drops any field the provider sent beyond the six", async () => {
    const extra = { ...FAKE_PLACES[0], placeId: "ola-internal-id", raw: { secret: KEY } };
    const { deps } = setup({ getProvider: () => ({ autocomplete: async () => [extra as never] }) });
    const { text, body } = await call("kk nagar", deps);
    expect(text).not.toContain("ola-internal-id");
    expect(text).not.toContain(KEY);
    expect(body.ok && Object.keys(body.data[0] ?? {}).length).toBe(6);
  });

  it("answers 200 with an empty list when nothing matches", async () => {
    const { deps } = setup();
    const { response, body } = await call("zzzzzz nowhere", deps);
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, data: [] });
  });

  it("trims the typed text and hands the trimmed text to the provider", async () => {
    const { deps, fake } = setup();
    await call("   velachery   ", deps);
    expect(fake.asked).toEqual(["velachery"]);
  });

  it("accepts exactly 3 and exactly 80 characters, counted as people count them", async () => {
    const { deps } = setup();
    expect((await call("abc", deps)).response.status).toBe(200);
    expect((await call("a".repeat(80), deps)).response.status).toBe(200);
    expect((await call("😀".repeat(80), deps)).response.status).toBe(200);
  });
});

describe("UT-places-autocomplete: input is validated before anything is counted or called", () => {
  const rejected: Array<[string, string | null, string?]> = [
    ["missing", null],
    ["empty", ""],
    ["two characters", "ab"],
    ["only spaces", "      "],
    ["81 characters", "a".repeat(81)],
    ["81 emoji", "😀".repeat(81)],
    ["a line break inside", "kk\nnagar"],
    ["a tab inside", "kk\tnagar"],
    ["a null byte", "kk\u0000nagar"],
    ["a trailing line break", "kk nagar\n"],
    ["a line separator", "kk nagar"],
    ["a q given twice", null, "?q=kk%20nagar&q=velachery"],
  ];

  it.each(rejected)("refuses %s with 400 VALIDATION", async (_name, query, raw) => {
    const { deps, enforceLimits, fake } = setup();
    const { response, body } = await call(query, deps, raw);
    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, code: "VALIDATION", requestId: REQUEST_ID });
    expect(enforceLimits).not.toHaveBeenCalled();
    expect(fake.asked).toEqual([]);
  });
});

describe("UT-places-autocomplete: the rate limit", () => {
  it("counts a valid call once, before the provider is asked", async () => {
    const order: string[] = [];
    const { deps } = setup({
      enforceLimits: async () => void order.push("limit"),
      getProvider: () => ({
        autocomplete: async () => {
          order.push("provider");
          return [];
        },
      }),
    });
    await call("kk nagar", deps);
    expect(order).toEqual(["limit", "provider"]);
  });

  it("answers 429 RATE_LIMITED with reason limited and the seconds to wait, and never asks the provider", async () => {
    const { deps, fake } = setup({
      enforceLimits: async () => {
        throw new RateLimitedError("places", 41.2);
      },
    });
    const { response, body } = await call("kk nagar", deps);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(body).toEqual({
      ok: false,
      code: "RATE_LIMITED",
      reason: "limited",
      retryAfter: 42,
      requestId: REQUEST_ID,
    });
    expect(fake.asked).toEqual([]);
  });

  it("fails closed when the counter itself fails: 500, reason unavailable, reported, nothing asked", async () => {
    const { deps, fake, reportError } = setup({
      enforceLimits: async () => {
        throw new ActionError("INTERNAL", "The rate limit counter did not answer");
      },
    });
    const { response, body } = await call("kk nagar", deps);
    expect(response.status).toBe(500);
    expect(body).toEqual({
      ok: false,
      code: "INTERNAL",
      reason: "unavailable",
      requestId: REQUEST_ID,
    });
    expect(fake.asked).toEqual([]);
    expect(reportError).toHaveBeenCalledTimes(1);
  });
});

describe("UT-places-autocomplete: a provider that cannot answer (FR-GEO-01 criterion 3)", () => {
  it.each<[PlaceFailure, number, "unavailable" | "limited"]>([
    ["timeout", 502, "unavailable"],
    ["error", 502, "unavailable"],
    ["off", 503, "unavailable"],
    ["quota", 503, "limited"],
  ])("%s answers %i UPSTREAM_FAILED with reason %s", async (failure, status, reason) => {
    const { deps, reportError } = setup({ getProvider: () => providerThatFails(failure) });
    const { response, body, text } = await call("kk nagar", deps);
    expect(response.status).toBe(status);
    expect(body).toEqual({ ok: false, code: "UPSTREAM_FAILED", reason, requestId: REQUEST_ID });
    expect(text).not.toContain(KEY);
    expect(text).not.toContain("Lookup failed");
    // A provider failure is a known answer, not a bug: the error tracker is not told.
    expect(reportError).not.toHaveBeenCalled();
  });

  it("the kill switch (the off provider) answers 503 unavailable", async () => {
    const { deps } = setup({
      getProvider: () => createOffPlaceProvider("Place search is switched off"),
    });
    const { response, body } = await call("kk nagar", deps);
    expect(response.status).toBe(503);
    expect(body).toMatchObject({ ok: false, code: "UPSTREAM_FAILED", reason: "unavailable" });
  });

  it("answers 500 with reason unavailable, and reports it, when the provider or the settings read blows up", async () => {
    const reading = setup({
      getProvider: async () => {
        throw new Error(`settings failed for ${TYPED}`);
      },
    });
    const first = await call("kk nagar", reading.deps);
    expect(first.response.status).toBe(500);
    expect(first.body).toEqual({
      ok: false,
      code: "INTERNAL",
      reason: "unavailable",
      requestId: REQUEST_ID,
    });
    expect(first.text).not.toContain(TYPED);
    expect(reading.reportError).toHaveBeenCalledTimes(1);

    const lookup = setup({
      getProvider: () => ({
        autocomplete: async () => {
          throw new TypeError(`bad json near ${TYPED}`);
        },
      }),
    });
    expect((await call("kk nagar", lookup.deps)).response.status).toBe(500);
  });
});

describe("UT-places-autocomplete: nothing private leaves, nothing is cached", () => {
  it("sends Cache-Control: no-store and the request id on every kind of answer", async () => {
    const cases: Array<Partial<PlaceAutocompleteDeps>> = [
      {},
      { enforceLimits: async () => Promise.reject(new RateLimitedError("places", 5)) },
      { getProvider: () => providerThatFails("timeout") },
      { getProvider: () => providerThatFails("quota") },
      { getProvider: () => createOffPlaceProvider("off") },
      { getProvider: () => Promise.reject(new Error("boom")) },
    ];
    for (const overrides of cases) {
      const { deps } = setup(overrides);
      const { response } = await call("kk nagar", deps);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(response.headers.get("x-request-id")).toBe(REQUEST_ID);
    }
    const { deps } = setup();
    const bad = await call("ab", deps);
    expect(bad.response.headers.get("Cache-Control")).toBe("no-store");
    expect(bad.response.headers.get("Content-Type")).toContain("application/json");
  });

  it("never writes the typed text, a place name or the key to a log line, on any path", async () => {
    const kinds: Array<Partial<PlaceAutocompleteDeps>> = [
      {},
      { enforceLimits: async () => Promise.reject(new RateLimitedError("places", 5)) },
      { enforceLimits: async () => Promise.reject(new ActionError("INTERNAL", `counter ${KEY}`)) },
      { getProvider: () => providerThatFails("timeout") },
      { getProvider: () => providerThatFails("error") },
      { getProvider: () => providerThatFails("quota") },
      { getProvider: () => providerThatFails("off") },
      { getProvider: () => Promise.reject(new Error(`unexpected ${TYPED} ${KEY}`)) },
      {
        getProvider: () => ({
          autocomplete: async () => {
            throw new Error(`parse failed ${TYPED} ${KEY}`);
          },
        }),
      },
    ];
    for (const overrides of kinds) {
      const { deps, lines } = setup(overrides);
      await call(TYPED, deps);
      const written = lines.join("\n");
      expect(written).not.toContain(TYPED);
      expect(written).not.toContain("Zanzibar");
      expect(written).not.toContain(KEY);
      for (const place of FAKE_PLACES) expect(written).not.toContain(place.label);
    }
  });

  it("writes only the failure class for a failed lookup, and tags every line with the request id", async () => {
    const { deps, lines } = setup({ getProvider: () => providerThatFails("timeout") });
    await call(TYPED, deps);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}")).toMatchObject({
      level: "warn",
      msg: "place lookup failed",
      failure: "timeout",
      requestId: REQUEST_ID,
    });
  });

  it("never puts the typed text or the key in a response, even from an unexpected failure", async () => {
    const { deps } = setup({
      getProvider: () => ({
        autocomplete: async () => {
          throw new Error(`failed for ${TYPED} with ${KEY}`);
        },
      }),
    });
    const { text } = await call(TYPED, deps);
    expect(text).not.toContain(TYPED);
    expect(text).not.toContain(KEY);
  });
});

describe("UT-places-usage: one call that reaches the provider is counted once (ADR-133 update, ADR-134)", () => {
  it("counts a lookup that found places as ok, for the search box when no source is given", async () => {
    const { deps, recorded } = setup();
    const { response } = await call("kk nagar", deps);
    expect(response.status).toBe(200);
    expect(recorded).toEqual([{ api: "autocomplete", caller: "search_box", outcome: "ok" }]);
  });

  it("counts a lookup that found nothing as empty", async () => {
    const { deps, recorded } = setup();
    const { body } = await call("zzzzzz nowhere", deps);
    expect(body).toEqual({ ok: true, data: [] });
    expect(recorded).toEqual([{ api: "autocomplete", caller: "search_box", outcome: "empty" }]);
  });

  it.each<["timeout" | "quota" | "error"]>([["timeout"], ["quota"], ["error"]])(
    "counts a provider failure of class %s with that outcome",
    async (failure) => {
      const { deps, recorded } = setup({ getProvider: () => providerThatFails(failure) });
      await call("kk nagar", deps);
      expect(recorded).toEqual([{ api: "autocomplete", caller: "search_box", outcome: failure }]);
    },
  );

  it.each(["search_box", "listing_form", "admin_picker"] as const)(
    "labels the count with the source %s",
    async (source) => {
      const { deps, recorded } = setup();
      await call(null, deps, `/api/places/autocomplete?q=velachery&source=${source}`);
      expect(recorded).toEqual([{ api: "autocomplete", caller: source, outcome: "ok" }]);
    },
  );

  it.each([
    ["an unknown source", "?q=velachery&source=hacker"],
    ["ai_chat, which this route never serves", "?q=velachery&source=ai_chat"],
    ["an empty source", "?q=velachery&source="],
    ["a source given twice", "?q=velachery&source=search_box&source=listing_form"],
    ["a source in the wrong case", "?q=velachery&source=Search_Box"],
  ])("refuses %s with 400 VALIDATION and counts nothing", async (_name, query) => {
    const { deps, recorded, enforceLimits, fake } = setup();
    const { response, body } = await call(null, deps, `/api/places/autocomplete${query}`);
    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, code: "VALIDATION", requestId: REQUEST_ID });
    expect(enforceLimits).not.toHaveBeenCalled();
    expect(fake.asked).toEqual([]);
    expect(recorded).toEqual([]);
  });

  it("does not count a bad q, whatever the source", async () => {
    const { deps, recorded } = setup();
    await call(null, deps, "/api/places/autocomplete?q=ab&source=listing_form");
    expect(recorded).toEqual([]);
  });

  it("does not count a call our own limit refused", async () => {
    const { deps, recorded, recordUsage } = setup({
      enforceLimits: async () => {
        throw new RateLimitedError("places", 41.2);
      },
    });
    expect((await call("kk nagar", deps)).response.status).toBe(429);
    expect(recordUsage).not.toHaveBeenCalled();
    expect(recorded).toEqual([]);
  });

  it("does not count a call when the counter fails, or the settings read blows up", async () => {
    const cases: Array<Partial<PlaceAutocompleteDeps>> = [
      { enforceLimits: async () => Promise.reject(new ActionError("INTERNAL", "counter down")) },
      { getProvider: () => Promise.reject(new Error("settings down")) },
    ];
    for (const overrides of cases) {
      const { deps, recordUsage } = setup(overrides);
      expect((await call("kk nagar", deps)).response.status).toBe(500);
      expect(recordUsage).not.toHaveBeenCalled();
    }
  });

  it("does not count the kill switch or a missing key (failure off): nothing reached the provider", async () => {
    for (const getProvider of [
      () => providerThatFails("off"),
      () => createOffPlaceProvider("Place search is switched off"),
    ]) {
      const { deps, recordUsage } = setup({ getProvider });
      expect((await call("kk nagar", deps)).response.status).toBe(503);
      expect(recordUsage).not.toHaveBeenCalled();
    }
  });

  it("counts exactly one call for one lookup", async () => {
    const { deps, recordUsage } = setup();
    await call("kk nagar", deps);
    expect(recordUsage).toHaveBeenCalledTimes(1);
  });

  it("hands the count over as work to run later: the answer is returned while the write is still waiting", async () => {
    const waiting: Array<() => void> = [];
    const written: PlacesUsageRecord[] = [];
    const { deps } = setup({
      // The same shape as the route: the write is scheduled, and it runs only when the framework runs it later.
      recordUsage: (record) => void waiting.push(() => void written.push(record)),
    });
    const { response, body } = await call("kk nagar", deps);
    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(written).toEqual([]);
    expect(waiting).toHaveLength(1);
    for (const run of waiting) run();
    expect(written).toEqual([{ api: "autocomplete", caller: "search_box", outcome: "ok" }]);
  });

  it("never changes the answer when scheduling the count throws, and says so in one line without the typed text", async () => {
    const throwing = () => {
      throw new Error(`after() outside a request for ${TYPED} ${KEY}`);
    };
    const success = setup({ recordUsage: throwing });
    const answered = await call("kk nagar", success.deps);
    expect(answered.response.status).toBe(200);
    expect(answered.body.ok).toBe(true);
    expect(success.lines).toHaveLength(1);

    const failed = setup({
      recordUsage: throwing,
      getProvider: () => providerThatFails("timeout"),
    });
    const refused = await call(TYPED, failed.deps);
    expect(refused.response.status).toBe(502);
    expect(refused.body).toEqual({
      ok: false,
      code: "UPSTREAM_FAILED",
      reason: "unavailable",
      requestId: REQUEST_ID,
    });

    for (const { lines } of [success, failed]) {
      const written = lines.join("\n");
      expect(written).not.toContain(TYPED);
      expect(written).not.toContain(KEY);
    }
  });

  it("runs the same with no counter at all (a deployment that does not reach the provider)", async () => {
    const { deps } = setup();
    delete deps.recordUsage;
    expect((await call("kk nagar", deps)).response.status).toBe(200);
  });

  it("hands the counter only the three closed values, never the typed text or a place name", async () => {
    const { deps, recorded } = setup();
    await call(
      null,
      deps,
      `/api/places/autocomplete?q=${encodeURIComponent(TYPED)}&source=admin_picker`,
    );
    await call("kk nagar", deps);
    expect(recorded).toHaveLength(2);
    for (const record of recorded) {
      expect(Object.keys(record).sort()).toEqual(["api", "caller", "outcome"]);
      const serialised = JSON.stringify(record);
      expect(serialised).not.toContain("Zanzibar");
      for (const place of FAKE_PLACES) expect(serialised).not.toContain(place.label);
    }
  });
});
