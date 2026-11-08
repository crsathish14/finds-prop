import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  current: { data: null as unknown, error: null as null | { code: string; message?: string } },
  update: {
    data: [] as { status: string }[],
    error: null as null | { code: string; message?: string },
  },
  asked: [] as string[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({ createServerSupabase: async () => ({}) }));

const client = {
  rpc: (name: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: string) => ({
        maybeSingle: async () => {
          db.asked.push(`rpc:${name}:${columns}:${column}:${value}`);
          return db.current;
        },
      }),
    }),
  }),
  from: (table: string) => ({
    update: (row: unknown) => ({
      eq: (column: string, value: string) => ({
        eq: (statusColumn: string, status: string) => ({
          select: async (columns: string) => {
            db.asked.push(
              `update:${table}:${JSON.stringify(row)}:${column}:${value}:${statusColumn}:${status}:${columns}`,
            );
            return db.update;
          },
        }),
      }),
    }),
  }),
};

const { myListingsStore } = await import("../my-listings-store");
const store = () => myListingsStore(client as unknown as Parameters<typeof myListingsStore>[0]);

beforeEach(() => {
  db.current = { data: null, error: null };
  db.update = { data: [], error: null };
  db.asked = [];
});

describe("UT-listing-changes-store: the owner's edit calls to the database (S6-T05)", () => {
  it("reads the caller's own listing through my_properties, by id", async () => {
    db.current = { data: { short_id: "abcd2345", status: "approved" }, error: null };
    expect(await store().current("l1")).toEqual({ shortId: "abcd2345", status: "approved" });
    expect(db.asked).toEqual(["rpc:my_properties:short_id, status:id:l1"]);
  });

  it("finds nothing for a listing that is not the caller's", async () => {
    expect(await store().current("l1")).toBeNull();
  });

  it("turns a failed read into an action error", async () => {
    db.current = { data: null, error: { code: "XX000" } };
    await expect(store().current("l1")).rejects.toMatchObject({ code: "INTERNAL" });
  });

  it("updates only while the listing is still in the state it was read in, and answers the state after", async () => {
    db.update = { data: [{ status: "pending" }], error: null };
    expect(await store().update("l1", { price: 100 }, "approved")).toBe("pending");
    expect(db.asked).toEqual(['update:properties:{"price":100}:id:l1:status:approved:status']);
  });

  it("answers null when no row was in that state any more", async () => {
    expect(await store().update("l1", { price: 100 }, "approved")).toBeNull();
  });

  it("turns the database's refusal of a sold or rented listing into a conflict", async () => {
    db.update = {
      data: [],
      error: { code: "P0001", message: "properties.terminal_status" },
    };
    await expect(store().update("l1", { price: 100 }, "sold")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
