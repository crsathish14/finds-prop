import { beforeEach, describe, expect, it, vi } from "vitest";

const getProperty = vi.fn();
vi.mock("@/features/property", () => ({ getProperty }));

const { getComparedHomes, getComparedProperties } = await import("../queries");

const home = (shortId: string) => ({ shortId, title: `Home ${shortId}` });

beforeEach(() => vi.clearAllMocks());

describe("UT-compare-queries: the homes of a comparison", () => {
  it("reads each home the way the property page does, in the order of the ids", async () => {
    getProperty.mockImplementation(async (id: string) => ({ status: "found", property: home(id) }));
    const homes = await getComparedProperties(["k3x9a2bd", "m4y8b3ce"]);
    expect(getProperty.mock.calls.map((call) => call[0])).toEqual(["k3x9a2bd", "m4y8b3ce"]);
    expect(homes.map((entry) => entry.shortId)).toEqual(["k3x9a2bd", "m4y8b3ce"]);
  });

  it("leaves out a home that is gone, without an error", async () => {
    getProperty.mockImplementation(async (id: string) =>
      id === "m4y8b3ce" ? { status: "missing" } : { status: "found", property: home(id) },
    );
    const homes = await getComparedProperties(["k3x9a2bd", "m4y8b3ce", "n5z7c4dh"]);
    expect(homes.map((entry) => entry.shortId)).toEqual(["k3x9a2bd", "n5z7c4dh"]);
  });

  it("reads nothing for no ids", async () => {
    expect(await getComparedProperties([])).toEqual([]);
    expect(getProperty).not.toHaveBeenCalled();
  });

  it("fails, as the property page's read does, when a read fails", async () => {
    getProperty.mockRejectedValue(new Error("property could not be read"));
    await expect(getComparedProperties(["k3x9a2bd"])).rejects.toThrow("could not be read");
  });
});

describe("UT-compare-queries: the time the homes were read", () => {
  it("gives the oldest read time of all the homes, a home that is gone included", async () => {
    getProperty.mockImplementation(async (id: string) =>
      id === "m4y8b3ce"
        ? { status: "missing", readAt: "2026-11-13T10:00:00.000Z" }
        : { status: "found", property: home(id), readAt: "2026-11-13T10:12:00.000Z" },
    );
    const compared = await getComparedHomes(["k3x9a2bd", "m4y8b3ce"]);
    expect(compared.readAt).toBe("2026-11-13T10:00:00.000Z");
    expect(compared.properties.map((entry) => entry.shortId)).toEqual(["k3x9a2bd"]);
  });
});
