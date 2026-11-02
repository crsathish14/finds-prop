import zlib from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import {
  assertSeedTarget,
  buildPng,
  buildSampleImages,
  isLocalSupabaseUrl,
  planListingMedia,
  planProjectImages,
  restoreValues,
  runSeedDev,
  SeedRefusal,
  SEED_USERS,
} from "../lib/seed-dev-core.mjs";

const LOCAL = "http://127.0.0.1:54321";
const HOSTED = "https://abcdefghij.supabase.co";
const KEY = "a-service-key-that-is-long-enough-to-pass-the-check";

describe("UT-seed-dev: where it may write (R-DB-13)", () => {
  it.each(["http://127.0.0.1:54321", "http://localhost:54321", "http://[::1]:54321"])(
    "treats %s as the local stack",
    (url) => {
      expect(isLocalSupabaseUrl(url)).toBe(true);
      expect(assertSeedTarget({ url })).toEqual({ local: true });
    },
  );

  it.each([
    "https://127.0.0.1:54321",
    "http://example.com",
    "http://127.0.0.1.evil.example",
    "http://localhost.evil.example",
    "not a url",
    "",
  ])("does not treat %j as local", (url) => {
    expect(isLocalSupabaseUrl(url)).toBe(false);
  });

  it("refuses a hosted project unless it is named twice", () => {
    expect(() => assertSeedTarget({ url: HOSTED })).toThrow(SeedRefusal);
    expect(() => assertSeedTarget({ url: HOSTED, hosted: true })).toThrow(/SEED_ALLOW_URL/);
    expect(() =>
      assertSeedTarget({
        url: HOSTED,
        hosted: true,
        allowedUrl: "https://otherproject1.supabase.co",
      }),
    ).toThrow(/exactly/);
    expect(assertSeedTarget({ url: HOSTED, hosted: true, allowedUrl: `${HOSTED}/` })).toEqual({
      local: false,
    });
  });

  it("refuses --hosted for a local address, and refuses a missing or invalid address", () => {
    expect(() => assertSeedTarget({ url: LOCAL, hosted: true })).toThrow(/local/);
    expect(() => assertSeedTarget({ url: undefined })).toThrow(SeedRefusal);
    expect(() => assertSeedTarget({ url: "http://" })).toThrow(SeedRefusal);
  });

  it("never puts an address or a key in a refusal", () => {
    for (const attempt of [
      () => assertSeedTarget({ url: HOSTED }),
      () =>
        assertSeedTarget({
          url: HOSTED,
          hosted: true,
          allowedUrl: "https://otherproject1.supabase.co",
        }),
    ]) {
      try {
        attempt();
      } catch (error) {
        expect(error.message).not.toContain("supabase.co");
      }
    }
  });
});

function readChunks(png) {
  const chunks = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const data = png.subarray(offset + 8, offset + 8 + length);
    chunks.push({
      type,
      data,
      stored: png.readUInt32BE(offset + 8 + length),
      typeAndData: png.subarray(offset + 4, offset + 8 + length),
    });
    offset += 12 + length;
  }
  return chunks;
}

describe("UT-seed-dev: the sample pictures", () => {
  it("builds a valid PNG: signature, checksums, size and pixels", () => {
    const png = buildPng({
      width: 8,
      height: 4,
      pixel: (column, row) => [column * 30, row * 60, 200],
    });
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const chunks = readChunks(png);
    expect(chunks.map((chunk) => chunk.type)).toEqual(["IHDR", "IDAT", "IEND"]);
    const header = chunks[0].data;
    expect([header.readUInt32BE(0), header.readUInt32BE(4), header[8], header[9]]).toEqual([
      8, 4, 8, 2,
    ]);
    // The inflated data is one filter byte plus three bytes per pixel, per row.
    const raw = zlib.inflateSync(chunks[1].data);
    expect(raw.length).toBe((8 * 3 + 1) * 4);
    expect([...raw.subarray(1 + 3 * 2, 1 + 3 * 2 + 3)]).toEqual([60, 0, 200]);
    // Every chunk's checksum matches its content.
    for (const chunk of chunks) expect(zlib.crc32(chunk.typeAndData)).toBe(chunk.stored);
  });

  it("builds six different, small, deterministic pictures", () => {
    const first = buildSampleImages({ width: 120, height: 80 });
    const second = buildSampleImages({ width: 120, height: 80 });
    expect(first).toHaveLength(6);
    expect(new Set(first.map((image) => image.bytes.toString("base64"))).size).toBe(6);
    expect(first.map((image) => image.bytes.toString("base64"))).toEqual(
      second.map((image) => image.bytes.toString("base64")),
    );
    for (const image of first) {
      expect(image.mime).toBe("image/png");
      expect([image.width, image.height]).toEqual([120, 80]);
    }
  });

  it("keeps the default pictures far under the storage limits", () => {
    for (const image of buildSampleImages()) {
      expect(image.bytes.length).toBeGreaterThan(0);
      expect(image.bytes.length).toBeLessThan(524288); // the smallest bucket limit, 500 KB
    }
  });
});

const images = buildSampleImages({ width: 64, height: 48 });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("UT-seed-dev: what is planned", () => {
  const owner = "5eed0000-0000-4000-8000-000000000001";
  const listing = "11111111-1111-4111-8111-111111111111";

  it("plans three photos in the path the storage policy accepts, with rows that fit the table", () => {
    const plan = planListingMedia({ listingId: listing, ownerId: owner, images });
    expect(plan).toHaveLength(3);
    expect(new Set(plan.map((photo) => photo.path)).size).toBe(3);
    for (const [position, photo] of plan.entries()) {
      const [first, second, file] = photo.path.split("/");
      expect(first).toMatch(UUID);
      expect(second).toMatch(UUID);
      expect(file).toBe(`photo-${position + 1}.png`);
      expect(photo.record).toMatchObject({
        listing_id: listing,
        storage_path: photo.path,
        mime: "image/png",
        position,
      });
      expect(photo.record.bytes).toBe(photo.image.bytes.length);
      expect(photo.record.width).toBeGreaterThan(0);
      expect(photo.record.height).toBeGreaterThan(0);
      expect(photo.record.alt_text.length).toBeLessThanOrEqual(200);
    }
    expect(plan.length).toBeLessThanOrEqual(6); // the listing_media limit
  });

  it("varies the pictures between listings", () => {
    const one = planListingMedia({ listingId: listing, ownerId: owner, images, offset: 0 });
    const two = planListingMedia({ listingId: listing, ownerId: owner, images, offset: 1 });
    expect(one[0].image).not.toBe(two[0].image);
  });

  it("plans project images at <project>/<file>", () => {
    const plan = planProjectImages({ projectId: "5eed0000-0000-4000-8002-000000000001", images });
    expect(plan).toHaveLength(3);
    for (const file of plan)
      expect(file.path).toMatch(new RegExp(`^${UUID.source.slice(1, -1)}/image-\\d\\.png$`));
  });

  it("restores only what an approved listing had", () => {
    expect(
      restoreValues({ status: "approved", featured: true, submitted_at: "2026-11-01T10:00:00Z" }),
    ).toEqual({
      status: "approved",
      featured: true,
      submitted_at: "2026-11-01T10:00:00Z",
    });
    expect(restoreValues({ status: "pending", featured: false, submitted_at: "x" })).toBeNull();
    expect(restoreValues({ status: "sold", featured: false, submitted_at: "x" })).toBeNull();
  });

  it("creates the reserved administrator only where it is local, and no one else is local-only", () => {
    expect(SEED_USERS.filter((user) => user.localOnly).map((user) => user.key)).toEqual(["admin"]);
    expect(SEED_USERS.every((user) => user.email || user.phone)).toBe(true);
    expect(new Set(SEED_USERS.map((user) => user.key)).size).toBe(SEED_USERS.length);
    for (const user of SEED_USERS.filter(
      (candidate) => candidate.email && candidate.key !== "admin",
    )) {
      expect(user.email).toMatch(/@seed\.example$/);
    }
  });
});

/** A small in-memory stand-in for the Supabase endpoints the script calls, including the trigger that sends an approved listing back to review. */
function fakeServer() {
  const state = {
    users: [],
    builders: new Map(),
    roles: [],
    uploads: [],
    media: [],
    listings: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        owner_id: "5eed0000-0000-4000-8000-000000000001",
        status: "approved",
        featured: true,
        submitted_at: "2026-11-01T10:00:00Z",
        short_id: "seedaaaa",
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        owner_id: "5eed0000-0000-4000-8000-000000000002",
        status: "approved",
        featured: false,
        submitted_at: "2026-11-01T11:00:00Z",
        short_id: "seedaaab",
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        owner_id: "5eed0000-0000-4000-8000-000000000003",
        status: "pending",
        featured: false,
        submitted_at: "2026-11-01T12:00:00Z",
        short_id: "seedaaac",
      },
    ],
    projects: [
      { id: "5eed0000-0000-4000-8002-000000000001", images: [] },
      { id: "5eed0000-0000-4000-8002-000000000002", images: [] },
    ],
    calls: [],
  };
  const respond = (status, body) => ({ status, json: async () => body });
  const fetchImpl = async (address, options = {}) => {
    const url = new URL(address);
    const method = options.method ?? "GET";
    state.calls.push(`${method} ${url.pathname}`);
    const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    if (method === "POST" && url.pathname === "/auth/v1/admin/users") {
      const existing = state.users.find(
        (user) =>
          (body.email && user.email === body.email) ||
          (body.phone && user.phone === body.phone.replace(/^\+/, "")),
      );
      if (existing) return respond(422, { error_code: "user_exists" });
      const user = {
        id: `00000000-0000-4000-8000-${String(state.users.length + 1).padStart(12, "0")}`,
        email: body.email,
        phone: body.phone?.replace(/^\+/, ""),
      };
      state.users.push(user);
      return respond(200, user);
    }
    if (method === "GET" && url.pathname === "/auth/v1/admin/users")
      return respond(200, { users: state.users });
    if (method === "PATCH" && url.pathname === "/rest/v1/builders") {
      state.builders.set(url.searchParams.get("id").replace("eq.", ""), body.user_id);
      return respond(204);
    }
    if (method === "POST" && url.pathname === "/rest/v1/user_roles") {
      state.roles.push(body);
      return respond(201);
    }
    if (method === "GET" && url.pathname === "/rest/v1/properties") {
      return respond(
        200,
        state.listings.map((row) => ({
          id: row.id,
          owner_id: row.owner_id,
          status: row.status,
          featured: row.featured,
          submitted_at: row.submitted_at,
        })),
      );
    }
    if (method === "GET" && url.pathname === "/rest/v1/listing_media")
      return respond(
        200,
        state.media.map((row) => ({ listing_id: row.listing_id })),
      );
    if (method === "POST" && url.pathname.startsWith("/storage/v1/object/")) {
      state.uploads.push(url.pathname.replace("/storage/v1/object/", ""));
      return respond(200, {});
    }
    if (method === "POST" && url.pathname === "/rest/v1/listing_media") {
      for (const row of body) {
        state.media.push(row);
        const listing = state.listings.find((candidate) => candidate.id === row.listing_id);
        if (listing.status === "approved")
          Object.assign(listing, {
            status: "pending",
            featured: false,
            submitted_at: "RESET-BY-TRIGGER",
          });
      }
      return respond(201);
    }
    if (method === "PATCH" && url.pathname === "/rest/v1/properties") {
      Object.assign(
        state.listings.find(
          (candidate) => candidate.id === url.searchParams.get("id").replace("eq.", ""),
        ),
        body,
      );
      return respond(204);
    }
    if (method === "GET" && url.pathname === "/rest/v1/projects")
      return respond(200, state.projects);
    if (method === "PATCH" && url.pathname === "/rest/v1/projects") {
      Object.assign(
        state.projects.find(
          (candidate) => candidate.id === url.searchParams.get("id").replace("eq.", ""),
        ),
        body,
      );
      return respond(204);
    }
    return respond(404, {});
  };
  return { state, fetchImpl };
}

describe("UT-seed-dev: a run against a stand-in server", () => {
  it("adds photos and puts every approved listing back exactly as it was", async () => {
    const { state, fetchImpl } = fakeServer();
    await runSeedDev({ fetch: fetchImpl, url: LOCAL, key: KEY, images });
    expect(state.media).toHaveLength(9);
    expect(
      state.listings.map((listing) => [listing.status, listing.featured, listing.submitted_at]),
    ).toEqual([
      ["approved", true, "2026-11-01T10:00:00Z"],
      ["approved", false, "2026-11-01T11:00:00Z"],
      ["pending", false, "2026-11-01T12:00:00Z"],
    ]);
  });

  it("uploads every file before its row, at the paths the rows name", async () => {
    const { state, fetchImpl } = fakeServer();
    await runSeedDev({ fetch: fetchImpl, url: LOCAL, key: KEY, images });
    const uploaded = new Set(state.uploads);
    for (const row of state.media)
      expect(uploaded.has(`listing-photos/${row.storage_path}`)).toBe(true);
    expect(state.uploads.filter((path) => path.startsWith("project-media/"))).toHaveLength(6);
    expect(state.projects.map((project) => project.images.length)).toEqual([3, 3]);
  });

  it("creates the test users, links the builders and gives them the builder role", async () => {
    const { state, fetchImpl } = fakeServer();
    const result = await runSeedDev({ fetch: fetchImpl, url: LOCAL, key: KEY, images });
    expect(result.users).toBe(SEED_USERS.length);
    expect(state.users).toHaveLength(SEED_USERS.length);
    expect(state.users.map((user) => user.email).filter(Boolean)).toContain(
      "developer@findsprop.com",
    );
    expect([...state.builders.keys()].sort()).toEqual(
      SEED_USERS.filter((user) => user.builderId)
        .map((user) => user.builderId)
        .sort(),
    );
    expect(state.roles.every((role) => role.role === "builder")).toBe(true);
    expect(state.roles).toHaveLength(4);
  });

  it("can run again and then adds nothing", async () => {
    const { state, fetchImpl } = fakeServer();
    await runSeedDev({ fetch: fetchImpl, url: LOCAL, key: KEY, images });
    const uploads = state.uploads.length;
    const media = state.media.length;
    await runSeedDev({ fetch: fetchImpl, url: LOCAL, key: KEY, images });
    expect(state.users).toHaveLength(SEED_USERS.length);
    expect(state.uploads).toHaveLength(uploads);
    expect(state.media).toHaveLength(media);
  });

  it("stops with a clear message when the seed data is not there", async () => {
    const { state, fetchImpl } = fakeServer();
    state.listings.length = 0;
    await expect(runSeedDev({ fetch: fetchImpl, url: LOCAL, key: KEY, images })).rejects.toThrow(
      /seed\.sql/,
    );
  });

  it("does not create the reserved administrator on a hosted project", async () => {
    const { state, fetchImpl } = fakeServer();
    await runSeedDev({
      fetch: fetchImpl,
      url: HOSTED,
      key: KEY,
      hosted: true,
      allowedUrl: HOSTED,
      images,
    });
    expect(state.users.map((user) => user.email)).not.toContain("developer@findsprop.com");
    expect(state.users).toHaveLength(SEED_USERS.length - 1);
  });

  it("refuses before any request when the target or the key is wrong", async () => {
    const fetchSpy = vi.fn();
    await expect(runSeedDev({ fetch: fetchSpy, url: HOSTED, key: KEY, images })).rejects.toThrow(
      SeedRefusal,
    );
    await expect(runSeedDev({ fetch: fetchSpy, url: LOCAL, key: "short", images })).rejects.toThrow(
      /service key/,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never logs the key or the address", async () => {
    const { fetchImpl } = fakeServer();
    const lines = [];
    await runSeedDev({
      fetch: fetchImpl,
      url: LOCAL,
      key: KEY,
      images,
      log: (line) => lines.push(line),
    });
    expect(lines.length).toBeGreaterThan(0);
    const text = lines.join("\n");
    expect(text).not.toContain(KEY);
    expect(text).not.toContain("127.0.0.1");
    expect(text).not.toMatch(/@/);
  });

  it("reports a failing request by route and status, never its body", async () => {
    const failing = async () => ({
      status: 401,
      json: async () => ({ secret: KEY }),
      text: async () => KEY,
    });
    const error = await runSeedDev({ fetch: failing, url: LOCAL, key: KEY, images }).catch(
      (caught) => caught,
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toMatch(/401/);
    expect(error.message).not.toContain(KEY);
  });
});
