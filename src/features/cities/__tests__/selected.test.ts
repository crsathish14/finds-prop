import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CityOption } from "../list";

const state = vi.hoisted(() => ({
  cookie: undefined as string | undefined,
  listed: [] as CityOption[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (state.cookie === undefined ? undefined : { value: state.cookie }),
  }),
}));
vi.mock("../queries", () => ({ getListedCities: async () => state.listed }));

const { getChosenCity, getSelectedCity } = await import("../selected");

const MADURAI: CityOption = { key: "madurai", name: "Madurai", count: 3 };

beforeEach(() => {
  state.cookie = undefined;
  state.listed = [MADURAI];
});

describe("getChosenCity (the hero and Browse by area name only a city the visitor chose)", () => {
  it("is nothing when no city was chosen, so the site's region is kept", async () => {
    expect(await getChosenCity()).toBeUndefined();
  });

  it("is the chosen city when it is listed", async () => {
    state.cookie = "madurai";
    expect(await getChosenCity()).toEqual(MADURAI);
  });

  it("is nothing when the remembered city is no longer listed", async () => {
    state.cookie = "coimbatore";
    expect(await getChosenCity()).toBeUndefined();
  });

  it("is Chennai when Chennai was chosen explicitly, even with no homes listed yet", async () => {
    state.cookie = "chennai";
    expect(await getChosenCity()).toEqual({ key: "chennai", name: "Chennai", count: 0 });
  });

  it("does not change what getSelectedCity shows when nothing was chosen (the default city)", async () => {
    expect(await getSelectedCity()).toMatchObject({ key: "chennai", name: "Chennai" });
  });
});
