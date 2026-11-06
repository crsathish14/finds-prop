import { describe, expect, it } from "vitest";
import { saveHome, unsaveHome, type SavedStore } from "../service";

const HOME_ID = "11111111-1111-4111-8111-111111111111";
const SHORT = "k3x9a2bd";

/** A store that keeps rows in memory, so the rules can be checked without a database. */
function fakeStore(options: { visible?: boolean; duplicate?: boolean } = {}) {
  const rows = new Set<string>();
  const calls = { find: [] as string[], insert: 0, remove: 0 };
  const store: SavedStore = {
    async findVisibleHome(shortId) {
      calls.find.push(shortId);
      return options.visible === false ? null : HOME_ID;
    },
    async insertSaved(propertyId) {
      calls.insert += 1;
      if (rows.has(propertyId) || options.duplicate) {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      }
      rows.add(propertyId);
    },
    async deleteSaved(propertyId) {
      calls.remove += 1;
      rows.delete(propertyId);
    },
  };
  return { store, rows, calls };
}

describe("saveHome: saving a home for the visitor (S5-T01)", () => {
  it("saves a home the visitor can see", async () => {
    const { store, rows } = fakeStore();
    expect(await saveHome(store, SHORT)).toEqual({ saved: true });
    expect(rows.has(HOME_ID)).toBe(true);
  });

  it("saving twice is the same as saving once", async () => {
    const { store, rows } = fakeStore();
    await saveHome(store, SHORT);
    expect(await saveHome(store, SHORT)).toEqual({ saved: true });
    expect(rows.size).toBe(1);
  });

  it("treats a row the database already has as saved, not as a failure", async () => {
    const { store } = fakeStore({ duplicate: true });
    await expect(saveHome(store, SHORT)).resolves.toEqual({ saved: true });
  });

  it("says not found for a home the visitor cannot see, whatever the reason", async () => {
    const { store, rows } = fakeStore({ visible: false });
    await expect(saveHome(store, SHORT)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(rows.size).toBe(0);
  });

  it("passes any other database error on, so the one error mapper can make it safe", async () => {
    const boom = Object.assign(new Error("connection reset"), { code: "08006" });
    const store: SavedStore = {
      findVisibleHome: async () => HOME_ID,
      insertSaved: async () => {
        throw boom;
      },
      deleteSaved: async () => undefined,
    };
    await expect(saveHome(store, SHORT)).rejects.toBe(boom);
  });
});

describe("unsaveHome: removing a home from the visitor's saved homes", () => {
  it("removes a saved home", async () => {
    const { store, rows } = fakeStore();
    await saveHome(store, SHORT);
    expect(await unsaveHome(store, SHORT)).toEqual({ saved: false });
    expect(rows.size).toBe(0);
  });

  it("removing a home that is not saved changes nothing and is not an error", async () => {
    const { store, rows, calls } = fakeStore();
    expect(await unsaveHome(store, SHORT)).toEqual({ saved: false });
    expect(rows.size).toBe(0);
    expect(calls.remove).toBe(1);
  });

  it("does nothing for a home the visitor can no longer see (sold, rented or withdrawn)", async () => {
    const { store, calls } = fakeStore({ visible: false });
    expect(await unsaveHome(store, SHORT)).toEqual({ saved: false });
    expect(calls.remove).toBe(0);
  });
});
