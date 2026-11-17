import { describe, expect, it, vi } from "vitest";
import { choosePlaceProvider, FAKE_PLACES, PlaceLookupError } from "@/server/places";

const bounds = { south: 8.0, north: 13.6, west: 76.2, east: 80.4 };

describe("UT-places-index: the provider for each environment (R-BE-09)", () => {
  it("uses Ola when a key is set, in every environment", async () => {
    // A fresh Response each time: a body can be read only once.
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockImplementation(() => Promise.resolve(Response.json({ predictions: [] })));
    for (const APP_ENV of ["local", "dev", "staging", "production"] as const) {
      const provider = choosePlaceProvider(
        { APP_ENV, OLA_MAPS_API_KEY: "test-ola-key-value", PLACES_DISABLED: false },
        bounds,
        fetchImpl,
      );
      await provider.autocomplete("kk nagar");
    }
    expect(fetchImpl).toHaveBeenCalledTimes(4);
  });

  it("uses the fixed list on local and dev without a key, so a developer sees suggestions", async () => {
    for (const APP_ENV of ["local", "dev"] as const) {
      const provider = choosePlaceProvider({ APP_ENV, PLACES_DISABLED: false }, bounds);
      const found = await provider.autocomplete("velachery");
      expect(found.map((place) => place.id)).toContain(FAKE_PLACES[2]?.id);
    }
  });

  it("answers off on staging and production without a key, and never refuses to start", async () => {
    for (const APP_ENV of ["staging", "production"] as const) {
      const provider = choosePlaceProvider({ APP_ENV, PLACES_DISABLED: false }, bounds);
      const failure = await provider.autocomplete("velachery").catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(PlaceLookupError);
      expect((failure as PlaceLookupError).failure).toBe("off");
    }
  });

  it("answers off everywhere when the kill switch is on, without calling anything", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    for (const APP_ENV of ["local", "production"] as const) {
      const provider = choosePlaceProvider(
        { APP_ENV, OLA_MAPS_API_KEY: "test-ola-key-value", PLACES_DISABLED: true },
        bounds,
        fetchImpl,
      );
      const failure = await provider.autocomplete("velachery").catch((error: unknown) => error);
      expect((failure as PlaceLookupError).failure).toBe("off");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never puts the key in the off message", async () => {
    const provider = choosePlaceProvider({ APP_ENV: "production", PLACES_DISABLED: false }, bounds);
    const failure = (await provider
      .autocomplete("velachery")
      .catch((error: unknown) => error)) as Error;
    expect(failure.message).toContain("OLA_MAPS_API_KEY");
    expect(failure.message).not.toMatch(/=\s*\S/);
  });
});

describe("UT-places-fake: the fixed list", () => {
  it("matches names by letters and digits only", async () => {
    const provider = choosePlaceProvider({ APP_ENV: "local", PLACES_DISABLED: false }, bounds);
    for (const typed of ["T. Nagar", "t nagar", "tnagar"]) {
      const found = await provider.autocomplete(typed);
      expect(found.map((place) => place.label)).toContain("T Nagar");
    }
  });

  it("answers an empty list for text that matches nothing", async () => {
    const provider = choosePlaceProvider({ APP_ENV: "local", PLACES_DISABLED: false }, bounds);
    expect(await provider.autocomplete("qwxzy")).toEqual([]);
  });
});
