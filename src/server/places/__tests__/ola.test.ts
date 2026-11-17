import { describe, expect, it, vi } from "vitest";
import { createOlaPlaceProvider } from "@/server/places/ola";
import { PlaceLookupError, type PlaceBounds } from "@/server/places/types";

const bounds: PlaceBounds = { south: 8.0, north: 13.6, west: 76.2, east: 80.4 };
const options = { apiKey: "test-ola-key-value", bounds };

type Item = Record<string, unknown>;

function item(overrides: Item = {}): Item {
  return {
    description: "KK Nagar, Chennai, Tamil Nadu, India",
    place_id: "ola-place-0001",
    layer: ["borough", "borough"],
    structured_formatting: { main_text: "KK Nagar", secondary_text: "Chennai, Tamil Nadu, India" },
    geometry: { location: { lat: 13.0415, lng: 80.1996 } },
    ...overrides,
  };
}

function answering(predictions: unknown[]) {
  return vi.fn<typeof fetch>().mockResolvedValue(Response.json({ predictions }));
}

async function failure(run: Promise<unknown>): Promise<PlaceLookupError> {
  try {
    await run;
  } catch (error) {
    if (error instanceof PlaceLookupError) return error;
    throw error;
  }
  throw new Error("expected the provider to fail");
}

describe("UT-places-ola: the request (R-BE-09)", () => {
  it("asks for the typed text with the Chennai bias and the key", async () => {
    const fetchImpl = answering([item()]);
    await createOlaPlaceProvider({ ...options, fetchImpl }).autocomplete("kk nagar");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [address, init] = fetchImpl.mock.calls[0] ?? [];
    const url = new URL(String(address));
    expect(url.origin + url.pathname).toBe("https://api.olamaps.io/places/v1/autocomplete");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      input: "kk nagar",
      location: "13.0827,80.2707",
      radius: "50000",
      api_key: "test-ola-key-value",
    });
    expect(init?.headers).toHaveProperty("X-Request-Id");
  });

  it("sends the text as one encoded value, whatever it holds", async () => {
    const fetchImpl = answering([]);
    await createOlaPlaceProvider({ ...options, fetchImpl }).autocomplete("a&api_key=other#x");
    const [address] = fetchImpl.mock.calls[0] ?? [];
    const url = new URL(String(address));
    expect(url.searchParams.get("input")).toBe("a&api_key=other#x");
    expect(url.searchParams.getAll("api_key")).toEqual(["test-ola-key-value"]);
  });
});

describe("UT-places-ola: what comes back", () => {
  it("maps a suggestion to a name, the rest of the address, a kind and a point", async () => {
    const provider = createOlaPlaceProvider({ ...options, fetchImpl: answering([item()]) });
    expect(await provider.autocomplete("kk nagar")).toEqual([
      {
        id: "ola-place-0001",
        label: "KK Nagar",
        detail: "Chennai, Tamil Nadu, India",
        kind: "area",
        lat: 13.0415,
        lng: 80.1996,
      },
    ]);
  });

  it("puts areas first, then streets, then venues, keeping Ola's order inside a group", async () => {
    const venue = item({
      description: "Velachery Railway Station, Chennai, Tamil Nadu, India",
      place_id: "venue-1",
      layer: ["venue", "railway_station"],
      structured_formatting: undefined,
    });
    const street = item({
      description: "2nd Avenue, Anna Nagar, Chennai, Tamil Nadu, India",
      place_id: "street-1",
      layer: ["street"],
      structured_formatting: undefined,
    });
    const area = item({ place_id: "area-1" });
    const secondArea = item({ place_id: "area-2", layer: ["locality", "locality"] });
    const provider = createOlaPlaceProvider({
      ...options,
      fetchImpl: answering([venue, street, area, secondArea]),
    });
    const ids = (await provider.autocomplete("anna")).map((suggestion) => suggestion.id);
    expect(ids).toEqual(["area-1", "area-2", "street-1", "venue-1"]);
  });

  it("takes the name and the rest from the description when there is no structured text", async () => {
    const plain = item({ structured_formatting: undefined });
    const [only] = await createOlaPlaceProvider({
      ...options,
      fetchImpl: answering([plain]),
    }).autocomplete("kk nagar");
    expect(only).toMatchObject({ label: "KK Nagar", detail: "Chennai, Tamil Nadu, India" });
  });

  it("treats a suggestion with no layer as a venue", async () => {
    const [only] = await createOlaPlaceProvider({
      ...options,
      fetchImpl: answering([item({ layer: undefined })]),
    }).autocomplete("kk nagar");
    expect(only?.kind).toBe("venue");
  });

  it("returns an empty list when Ola found nothing", async () => {
    const provider = createOlaPlaceProvider({ ...options, fetchImpl: answering([]) });
    expect(await provider.autocomplete("xqzvw")).toEqual([]);
  });
});

describe("UT-places-ola: the region is enforced here, because the bias only ranks", () => {
  it("drops a suggestion whose point lies outside the region's bounds", async () => {
    const mumbai = item({
      description: "Bandra West, Mumbai, Maharashtra, India",
      geometry: { location: { lat: 19.06, lng: 72.83 } },
    });
    const provider = createOlaPlaceProvider({ ...options, fetchImpl: answering([mumbai]) });
    expect(await provider.autocomplete("bandra")).toEqual([]);
  });

  it("drops a suggestion inside the box that names another state", async () => {
    const karnataka = item({
      description: "Adyar, Karnataka, India",
      layer: ["locality", "locality"],
      geometry: { location: { lat: 12.9, lng: 77.6 } },
      structured_formatting: { main_text: "Adyar", secondary_text: "Karnataka, India" },
    });
    const provider = createOlaPlaceProvider({ ...options, fetchImpl: answering([karnataka]) });
    expect(await provider.autocomplete("adyar")).toEqual([]);
  });

  it("drops a suggestion inside the box that names no state at all", async () => {
    const bangalore = item({
      description: "Adayar Ananda Bhavan, Kanakapura Road, Bangalore, 560062, India",
      layer: ["venue", "restaurant"],
      geometry: { location: { lat: 12.88, lng: 77.55 } },
      structured_formatting: undefined,
    });
    const provider = createOlaPlaceProvider({ ...options, fetchImpl: answering([bangalore]) });
    expect(await provider.autocomplete("adayar")).toEqual([]);
  });

  it("keeps a Puducherry place, because it lies inside the region", async () => {
    const puducherry = item({
      description: "Auroville, Puducherry, India",
      geometry: { location: { lat: 12.0, lng: 79.8 } },
    });
    const provider = createOlaPlaceProvider({ ...options, fetchImpl: answering([puducherry]) });
    expect(await provider.autocomplete("auroville")).toHaveLength(1);
  });

  it("drops a state or a country, which is too broad to search around", async () => {
    const wide = item({ description: "Tamil Nadu, India", layer: ["region", "region"] });
    const provider = createOlaPlaceProvider({ ...options, fetchImpl: answering([wide]) });
    expect(await provider.autocomplete("tamil nadu")).toEqual([]);
  });

  it("skips a suggestion with no usable point or no description, and keeps the rest", async () => {
    const noPoint = item({ geometry: undefined });
    const noText = item({ description: "" });
    const wrongType = "not an object";
    const good = item({ place_id: "good-1" });
    const provider = createOlaPlaceProvider({
      ...options,
      fetchImpl: answering([noPoint, noText, wrongType, good]),
    });
    expect((await provider.autocomplete("kk")).map((suggestion) => suggestion.id)).toEqual([
      "good-1",
    ]);
  });

  it("keeps at most eight suggestions", async () => {
    const many = Array.from({ length: 12 }, (_value, index) =>
      item({ place_id: `place-${index}` }),
    );
    const provider = createOlaPlaceProvider({ ...options, fetchImpl: answering(many) });
    expect(await provider.autocomplete("kk nagar")).toHaveLength(8);
  });
});

describe("UT-places-ola: failures", () => {
  it("says quota on HTTP 429", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("slow down", { status: 429 }));
    const refusal = await failure(
      createOlaPlaceProvider({ ...options, fetchImpl }).autocomplete("kk"),
    );
    expect(refusal.failure).toBe("quota");
    expect(refusal.code).toBe("UPSTREAM_FAILED");
  });

  it.each([401, 403, 500, 502])("says error on HTTP %s", async (status) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("no", { status }));
    const refusal = await failure(
      createOlaPlaceProvider({ ...options, fetchImpl }).autocomplete("kk"),
    );
    expect(refusal.failure).toBe("error");
  });

  it("says error on an answer that is not JSON or has no predictions", async () => {
    for (const body of [new Response("<html>gateway</html>"), Response.json({ status: "ok" })]) {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(body);
      const refusal = await failure(
        createOlaPlaceProvider({ ...options, fetchImpl }).autocomplete("kk"),
      );
      expect(refusal.failure).toBe("error");
    }
  });

  it("says error when the network fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    const refusal = await failure(
      createOlaPlaceProvider({ ...options, fetchImpl }).autocomplete("kk"),
    );
    expect(refusal.failure).toBe("error");
  });

  it("gives up when Ola is too slow and says timeout", async () => {
    const slow = vi.fn<typeof fetch>().mockImplementation(
      (_address, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const started = Date.now();
    const refusal = await failure(
      createOlaPlaceProvider({ ...options, fetchImpl: slow, timeoutMs: 20 }).autocomplete("kk"),
    );
    expect(refusal.failure).toBe("timeout");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("allows 3 seconds by default", async () => {
    vi.useFakeTimers();
    try {
      const slow = vi.fn<typeof fetch>().mockImplementation(
        (_address, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      );
      const pending = failure(
        createOlaPlaceProvider({ ...options, fetchImpl: slow }).autocomplete("kk"),
      );
      await vi.advanceTimersByTimeAsync(2999);
      let settled = false;
      void pending.then(() => {
        settled = true;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(2);
      expect((await pending).failure).toBe("timeout");
    } finally {
      vi.useRealTimers();
    }
  });

  it("never puts the key, the typed text or a place name in an error (R-BE-10)", async () => {
    const answers = [
      vi.fn<typeof fetch>().mockResolvedValue(new Response("no", { status: 429 })),
      vi.fn<typeof fetch>().mockResolvedValue(new Response("no", { status: 500 })),
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json({ oops: "KK Nagar test-ola-key-value" })),
      vi.fn<typeof fetch>().mockRejectedValue(new Error("connect to test-ola-key-value failed")),
    ];
    for (const fetchImpl of answers) {
      const refusal = await failure(
        createOlaPlaceProvider({ ...options, fetchImpl }).autocomplete("secret place text"),
      );
      for (const secret of ["test-ola-key-value", "secret place text", "KK Nagar", "api_key"]) {
        expect(refusal.message).not.toContain(secret);
      }
    }
  });
});
