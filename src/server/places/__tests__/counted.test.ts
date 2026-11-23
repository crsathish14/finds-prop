import { describe, expect, it, vi } from "vitest";
import {
  createCountedPlaceProvider,
  createFakePlaceProvider,
  PlaceLookupError,
  type PlaceProvider,
} from "@/server/places";

// UT-places-counted (ADR-134, ADR-142): a lookup that reaches the provider is counted once, with one of the five outcomes
// of the usage table and nothing else; a lookup that sent nothing is not counted; counting never changes the answer.

const failing = (failure: ConstructorParameters<typeof PlaceLookupError>[0]): PlaceProvider =>
  createFakePlaceProvider({ failWith: new PlaceLookupError(failure, "made-up failure") });

describe("UT-places-counted: the outcome of each lookup", () => {
  it("counts 'ok' when the provider found something, and gives the same suggestions", async () => {
    const count = vi.fn();
    const provider = createCountedPlaceProvider(createFakePlaceProvider(), count);
    const found = await provider.autocomplete("velachery");
    expect(found.length).toBeGreaterThan(0);
    expect(count).toHaveBeenCalledExactlyOnceWith("ok");
  });

  it("counts 'empty' when the provider answered with nothing", async () => {
    const count = vi.fn();
    const provider = createCountedPlaceProvider(createFakePlaceProvider(), count);
    expect(await provider.autocomplete("bandra mumbai")).toEqual([]);
    expect(count).toHaveBeenCalledExactlyOnceWith("empty");
  });

  it.each(["timeout", "quota", "error"] as const)(
    "counts '%s' and still throws the provider's failure",
    async (failure) => {
      const count = vi.fn();
      const provider = createCountedPlaceProvider(failing(failure), count);
      await expect(provider.autocomplete("velachery")).rejects.toMatchObject({ failure });
      expect(count).toHaveBeenCalledExactlyOnceWith(failure);
    },
  );

  it("does not count a lookup that sent nothing: the kill switch or a missing key", async () => {
    const count = vi.fn();
    const provider = createCountedPlaceProvider(failing("off"), count);
    await expect(provider.autocomplete("velachery")).rejects.toMatchObject({ failure: "off" });
    expect(count).not.toHaveBeenCalled();
  });

  it("does not count an unexpected error of our own", async () => {
    const count = vi.fn();
    const broken: PlaceProvider = { autocomplete: () => Promise.reject(new TypeError("a bug")) };
    await expect(createCountedPlaceProvider(broken, count).autocomplete("x")).rejects.toThrow(
      TypeError,
    );
    expect(count).not.toHaveBeenCalled();
  });

  it("never changes the answer when the count itself throws", async () => {
    const count = vi.fn(() => {
      throw new Error("the counter is down");
    });
    const provider = createCountedPlaceProvider(createFakePlaceProvider(), count);
    await expect(provider.autocomplete("velachery")).resolves.not.toHaveLength(0);
    const refused = createCountedPlaceProvider(failing("quota"), count);
    await expect(refused.autocomplete("velachery")).rejects.toMatchObject({ failure: "quota" });
  });

  it("passes the typed text on to the provider and gives the counter the outcome alone", async () => {
    const inner = createFakePlaceProvider();
    const count = vi.fn();
    await createCountedPlaceProvider(inner, count).autocomplete("kk nagar");
    expect(inner.asked).toEqual(["kk nagar"]);
    expect(count.mock.calls[0]).toEqual(["ok"]);
  });
});
