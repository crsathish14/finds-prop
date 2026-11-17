import { describe, expect, it } from "vitest";
import { createFakePlaceProvider, createOffPlaceProvider } from "@/server/places/fake";
import { normalisePlaceText, resolvePlace } from "@/server/places/resolve";
import { PlaceLookupError, type PlaceSuggestion } from "@/server/places/types";

function suggestion(overrides: Partial<PlaceSuggestion> & { id: string; label: string }) {
  return {
    detail: "Chennai, Tamil Nadu, India",
    kind: "area",
    lat: 13.0,
    lng: 80.2,
    ...overrides,
  } satisfies PlaceSuggestion;
}

describe("UT-places-resolve: cleaning the typed text", () => {
  it.each([
    ["K K Nagar", "KK Nagar"],
    ["K.K. Nagar", "KK Nagar"],
    ["K.K.Nagar", "KK Nagar"],
    ["T. Nagar", "T Nagar"],
    ["T Nagar", "T Nagar"],
    ["  anna   nagar ", "anna nagar"],
    ["A B C Colony", "ABC Colony"],
    ["Velachery", "Velachery"],
    ["வேளச்சேரி", "வேளச்சேரி"],
  ])("%s becomes %s", (typed, cleaned) => {
    expect(normalisePlaceText(typed)).toBe(cleaned);
  });
});

describe("UT-places-resolve: our own places first (no cost)", () => {
  it("uses a known place that has a position without calling the provider", async () => {
    const provider = createFakePlaceProvider();
    const answer = await resolvePlace("velacheri", {
      provider,
      knownPlaces: () => [{ label: "Velachery", lat: 12.9791, lng: 80.2212 }],
    });
    expect(answer).toEqual({
      status: "found",
      place: { label: "Velachery", lat: 12.9791, lng: 80.2212, source: "known" },
    });
    expect(provider.asked).toEqual([]);
  });

  it("asks the provider with the known spelling when the known place has no position", async () => {
    const provider = createFakePlaceProvider();
    const answer = await resolvePlace("vyasarpaadi", {
      provider,
      knownPlaces: () => [{ label: "Vyasarpadi", lat: null, lng: null }],
    });
    expect(provider.asked).toEqual(["Vyasarpadi"]);
    expect(answer).toMatchObject({ status: "found", place: { label: "Vyasarpadi" } });
  });

  it("gives the cleaned text to the known-places match", async () => {
    let received = "";
    await resolvePlace("K K Nagar", {
      provider: createFakePlaceProvider(),
      knownPlaces: (text) => {
        received = text;
        return [];
      },
    });
    expect(received).toBe("KK Nagar");
  });
});

describe("UT-places-resolve: what the suggestions mean", () => {
  it("is found when exactly one area matches", async () => {
    const answer = await resolvePlace("velachery", {
      provider: createFakePlaceProvider({
        places: [
          suggestion({ id: "a", label: "Velachery", lat: 12.9791, lng: 80.2212 }),
          suggestion({ id: "b", label: "Velachery Station", kind: "venue" }),
        ],
      }),
    });
    expect(answer).toEqual({
      status: "found",
      place: { label: "Velachery", lat: 12.9791, lng: 80.2212, source: "provider" },
    });
  });

  it("is found when several areas match but one is exactly what was typed", async () => {
    const answer = await resolvePlace("KK Nagar", { provider: createFakePlaceProvider() });
    expect(answer).toMatchObject({ status: "found", place: { label: "KK Nagar" } });
  });

  it("is a choice when several areas match and none is exactly what was typed", async () => {
    const answer = await resolvePlace("kk nag", { provider: createFakePlaceProvider() });
    expect(answer.status).toBe("choose");
    if (answer.status === "choose") {
      expect(answer.suggestions.map((place) => place.label)).toEqual(["KK Nagar", "KK Nagar West"]);
    }
  });

  it("uses the first venue that holds every typed word when no area came back", async () => {
    const answer = await resolvePlace("Velachery", {
      provider: createFakePlaceProvider({
        places: [
          suggestion({
            id: "station",
            label: "Main Gate Velachery Railway Station",
            kind: "venue",
            lat: 12.98,
            lng: 80.22,
          }),
          suggestion({ id: "other", label: "A shop", kind: "venue" }),
        ],
      }),
    });
    expect(answer).toMatchObject({
      status: "found",
      place: { label: "Main Gate Velachery Railway Station", lat: 12.98, lng: 80.22 },
    });
  });

  it("is none when the provider has nothing that holds the typed words", async () => {
    const answer = await resolvePlace("zzz place", {
      provider: createFakePlaceProvider({
        places: [suggestion({ id: "x", label: "Zzz Cafe", kind: "venue" })],
      }),
    });
    expect(answer.status).toBe("none");
  });
});

describe("UT-places-resolve: nothing and the second spelling", () => {
  it("is none when the provider finds nothing", async () => {
    const answer = await resolvePlace("qwxzy", { provider: createFakePlaceProvider() });
    expect(answer).toEqual({ status: "none" });
  });

  it("tries the alternative spelling once when the first finds nothing", async () => {
    const provider = createFakePlaceProvider();
    const answer = await resolvePlace("kk nagr", { provider, alternativeText: "KK Nagar" });
    expect(provider.asked).toEqual(["kk nagr", "KK Nagar"]);
    expect(answer).toMatchObject({ status: "found", place: { label: "KK Nagar" } });
  });

  it("makes at most two provider calls for one phrase", async () => {
    const provider = createFakePlaceProvider();
    const answer = await resolvePlace("qwxzy", { provider, alternativeText: "plmokn" });
    expect(provider.asked).toHaveLength(2);
    expect(answer).toEqual({ status: "none" });
  });

  it("does not ask twice for the same spelling", async () => {
    const provider = createFakePlaceProvider();
    await resolvePlace("qwxzy", { provider, alternativeText: "QWXZY" });
    expect(provider.asked).toHaveLength(1);
  });

  it("does not ask the alternative when the first spelling found something", async () => {
    const provider = createFakePlaceProvider();
    await resolvePlace("Velachery", { provider, alternativeText: "Vyasarpadi" });
    expect(provider.asked).toEqual(["Velachery"]);
  });
});

describe("UT-places-resolve: text that is not sent at all", () => {
  it.each(["", "  ", "ab", "a b", "x".repeat(81)])("%j makes no provider call", async (text) => {
    const provider = createFakePlaceProvider();
    expect(await resolvePlace(text, { provider })).toEqual({ status: "none" });
    expect(provider.asked).toEqual([]);
  });
});

describe("UT-places-resolve: when the provider cannot answer", () => {
  it.each(["timeout", "quota", "error"] as const)("says unavailable with %s", async (failure) => {
    const provider = createFakePlaceProvider({
      failWith: new PlaceLookupError(failure, "test failure"),
    });
    expect(await resolvePlace("Velachery", { provider })).toEqual({
      status: "unavailable",
      failure,
    });
  });

  it("says unavailable with off when place search is switched off", async () => {
    const provider = createOffPlaceProvider("switched off");
    expect(await resolvePlace("Velachery", { provider })).toEqual({
      status: "unavailable",
      failure: "off",
    });
  });

  it("lets an error that is not a place failure through", async () => {
    const provider = {
      autocomplete: () => Promise.reject(new Error("a bug, not a provider failure")),
    };
    await expect(resolvePlace("Velachery", { provider })).rejects.toThrow("a bug");
  });
});
