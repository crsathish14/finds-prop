// The logic of scripts/seed-dev.mjs (S3-T13), kept apart so tests can drive it with a fake `fetch`.
// seed-dev gives the fictional seed (supabase/seed.sql) what SQL cannot: sign-in-able test users, real
// photo files in Storage and the listing_media rows that point at them. It writes to a database, so it
// refuses to run against anything but the local stack, or a hosted project that the caller names twice
// (R-DB-13). It never prints a key, an address or a phone number.
import zlib from "node:zlib";

/** A refusal: the script stops before it touches the network. The message never holds a secret. */
export class SeedRefusal extends Error {
  constructor(message) {
    super(message);
    this.name = "SeedRefusal";
  }
}

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

export function isLocalSupabaseUrl(value) {
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === "http:" && LOCAL_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

function originOf(value) {
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Decides whether the script may write to this project. Local is always allowed. A hosted project
 * needs both `--hosted` and SEED_ALLOW_URL set to the very same address, so one slip never seeds a
 * shared database. Returns { local } or throws a SeedRefusal.
 */
export function assertSeedTarget({ url, hosted = false, allowedUrl }) {
  if (typeof url !== "string" || url.length === 0) {
    throw new SeedRefusal("no Supabase URL was given");
  }
  if (originOf(url) === null) throw new SeedRefusal("the Supabase URL is not a valid address");
  if (isLocalSupabaseUrl(url)) {
    if (hosted)
      throw new SeedRefusal("--hosted is for a hosted project, but this address is local");
    return { local: true };
  }
  if (!hosted) {
    throw new SeedRefusal(
      "this is not the local stack; to seed a hosted project pass --hosted and set SEED_ALLOW_URL to the same address",
    );
  }
  if (!allowedUrl || originOf(allowedUrl) !== originOf(url)) {
    throw new SeedRefusal("SEED_ALLOW_URL must be set to exactly the address being seeded");
  }
  return { local: false };
}

// ---------------------------------------------------------------------------------------------
// Sample pictures: real PNG files built here, so no image is stored in the repository.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1)
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, "ascii");
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, checksum]);
}

/** A valid 8-bit RGB PNG whose pixel at (column, row) is `pixel(column, row)`, an [r, g, b] triple. */
export function buildPng({ width, height, pixel }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: RGB
  const rowSize = width * 3 + 1;
  const raw = Buffer.alloc(rowSize * height);
  for (let row = 0; row < height; row += 1) {
    const rowStart = row * rowSize;
    raw[rowStart] = 0; // filter: none
    for (let column = 0; column < width; column += 1) {
      const [red, green, blue] = pixel(column, row);
      const offset = rowStart + 1 + column * 3;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const PALETTES = [
  { sky: [196, 224, 240], ground: [86, 140, 98], building: [236, 226, 208] },
  { sky: [250, 218, 190], ground: [120, 150, 90], building: [214, 192, 170] },
  { sky: [200, 210, 236], ground: [70, 120, 110], building: [232, 232, 240] },
  { sky: [240, 226, 196], ground: [150, 130, 90], building: [200, 170, 140] },
  { sky: [214, 232, 226], ground: [96, 148, 128], building: [244, 238, 226] },
  { sky: [226, 206, 214], ground: [110, 120, 100], building: [226, 214, 206] },
];

const mix = (from, to, amount) =>
  from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount));

/** Six different picture-like placeholders: sky, ground and a building with windows. Deterministic. */
export function buildSampleImages({ width = 960, height = 640 } = {}) {
  return PALETTES.map((palette, index) => {
    const buildingLeft = Math.round(width * (0.28 + (index % 3) * 0.04));
    const buildingRight = Math.round(width * (0.7 - (index % 2) * 0.05));
    const buildingTop = Math.round(height * (0.3 + (index % 3) * 0.05));
    const horizon = Math.round(height * 0.78);
    const bytes = buildPng({
      width,
      height,
      pixel: (column, row) => {
        if (row >= horizon)
          return mix(palette.ground, [40, 60, 50], (row - horizon) / (height - horizon));
        const inBuilding = column >= buildingLeft && column < buildingRight && row >= buildingTop;
        if (inBuilding) {
          const isWindow =
            (column - buildingLeft) % 56 > 30 &&
            (row - buildingTop) % 64 > 34 &&
            row < horizon - 40;
          return isWindow ? [70, 96, 120] : palette.building;
        }
        return mix(palette.sky, [255, 255, 255], row / horizon);
      },
    });
    return { name: `sample-${index + 1}`, mime: "image/png", width, height, bytes };
  });
}

// ---------------------------------------------------------------------------------------------
// What gets created

/** The listings the seed made are the ones whose short id starts with this (supabase/seed.sql). */
export const SEED_LISTING_PREFIX = "seed";
export const SEED_PROJECT_PREFIX = "5eed0000-0000-4000-8002-";
export const PHOTOS_PER_LISTING = 3;
export const IMAGES_PER_PROJECT = 3;

const BUILDER = (number) => `5eed0000-0000-4000-8001-${String(number).padStart(12, "0")}`;

/**
 * Test users, linked to the seeded builders where there is one. The reserved administrator exists
 * only on the local stack: on a hosted project that account signs in with Google (BR-12), and its
 * address must match reserved_admin_emails() in migration 20261101170000.
 */
export const SEED_USERS = [
  { key: "customer-a", phone: "919000000001", fullName: "Test Customer A" },
  { key: "customer-b", phone: "919000000002", fullName: "Test Customer B" },
  {
    key: "builder-a",
    email: "builder-a@seed.example",
    fullName: "Test Builder A",
    builderId: BUILDER(1),
  },
  {
    key: "builder-b",
    email: "builder-b@seed.example",
    fullName: "Test Builder B",
    builderId: BUILDER(2),
  },
  {
    key: "builder-inactive",
    email: "builder-inactive@seed.example",
    fullName: "Test Builder Inactive",
    builderId: BUILDER(5),
  },
  { key: "agent", email: "agent@seed.example", fullName: "Test Agent", builderId: BUILDER(6) },
  {
    key: "admin",
    email: "developer@findsprop.com",
    fullName: "Local Administrator",
    localOnly: true,
  },
];

/**
 * The photos for one listing: each the file to upload and the listing_media row that points at it,
 * stored at <owner>/<listing>/<file> (the path the storage policy expects).
 */
export function planListingMedia({
  listingId,
  ownerId,
  images,
  offset = 0,
  count = PHOTOS_PER_LISTING,
}) {
  return Array.from({ length: count }, (_, position) => {
    const image = images[(offset + position) % images.length];
    const path = `${ownerId}/${listingId}/photo-${position + 1}.png`;
    return {
      path,
      image,
      record: {
        listing_id: listingId,
        storage_path: path,
        mime: image.mime,
        bytes: image.bytes.length,
        width: image.width,
        height: image.height,
        position,
        alt_text: `Photo ${position + 1} of a fictional listing`,
      },
    };
  });
}

/** The image files for one project, at <project>/<file>. */
export function planProjectImages({ projectId, images, offset = 0, count = IMAGES_PER_PROJECT }) {
  return Array.from({ length: count }, (_, position) => ({
    path: `${projectId}/image-${position + 1}.png`,
    image: images[(offset + position) % images.length],
  }));
}

/**
 * Adding a photo sends an approved listing back to review (policy C), and that clears `featured` and
 * resets `submitted_at`. The seed wants its approved listings to stay approved, so these are the
 * values to put back afterwards.
 */
export function restoreValues(listing) {
  if (listing.status !== "approved") return null;
  return { status: "approved", featured: listing.featured, submitted_at: listing.submitted_at };
}

// ---------------------------------------------------------------------------------------------
// The run

function client({ fetch: fetchImpl, url, key }) {
  const base = url.replace(/\/+$/, "");
  const headers = (extra = {}) => ({ apikey: key, authorization: `Bearer ${key}`, ...extra });
  async function send(method, path, { body, headers: extra, expected = [200, 201, 204] } = {}) {
    const response = await fetchImpl(`${base}${path}`, {
      method,
      headers: headers(extra),
      ...(body !== undefined ? { body } : {}),
    });
    if (!expected.includes(response.status)) {
      // Status and route only: the body of an error can echo what was sent.
      throw new Error(`${method} ${path.split("?")[0]} answered ${response.status}`);
    }
    return response;
  }
  const json = (value) => JSON.stringify(value);
  return {
    async rest(method, path, value, { prefer } = {}) {
      const response = await send(method, `/rest/v1/${path}`, {
        ...(value !== undefined ? { body: json(value) } : {}),
        headers: { "content-type": "application/json", ...(prefer ? { prefer } : {}) },
      });
      return response.status === 204 || method !== "GET" ? null : response.json();
    },
    async createUser(user) {
      const response = await send("POST", "/auth/v1/admin/users", {
        body: json(user),
        headers: { "content-type": "application/json" },
        expected: [200, 201, 400, 409, 422],
      });
      return { status: response.status, body: await response.json().catch(() => ({})) };
    },
    async listUsers() {
      const response = await send("GET", "/auth/v1/admin/users?page=1&per_page=1000");
      const payload = await response.json();
      return Array.isArray(payload) ? payload : (payload.users ?? []);
    },
    async upload(bucket, path, image) {
      await send("POST", `/storage/v1/object/${bucket}/${path}`, {
        body: image.bytes,
        headers: { "content-type": image.mime, "x-upsert": "true" },
      });
    },
  };
}

const digitsOnly = (phone) => String(phone ?? "").replace(/^\+/, "");

function sameUser(candidate, user) {
  return Boolean(
    (user.email && candidate.email?.toLowerCase() === user.email.toLowerCase()) ||
    (user.phone && digitsOnly(candidate.phone) === digitsOnly(user.phone)),
  );
}

/** Creates (or finds) the test users and returns { key: userId }. */
async function ensureUsers(api, { local, log }) {
  const ids = {};
  let existing = null;
  for (const user of SEED_USERS) {
    if (user.localOnly && !local) continue;
    const created = await api.createUser({
      ...(user.email ? { email: user.email, email_confirm: true } : {}),
      ...(user.phone ? { phone: `+${user.phone}`, phone_confirm: true } : {}),
      user_metadata: { full_name: user.fullName },
    });
    if (created.status === 200 || created.status === 201) {
      ids[user.key] = created.body.id;
      continue;
    }
    existing ??= await api.listUsers();
    const found = existing.find((candidate) => sameUser(candidate, user));
    if (!found) throw new Error(`could not create or find the ${user.key} test user`);
    ids[user.key] = found.id;
  }
  log(`users: ${Object.keys(ids).length} ready`);
  return ids;
}

/** Links each builder user to its seeded builder record and gives it the builder role. */
async function linkBuilders(api, ids, { log }) {
  let linked = 0;
  for (const user of SEED_USERS) {
    if (!user.builderId || !ids[user.key]) continue;
    await api.rest("PATCH", `builders?id=eq.${user.builderId}&user_id=is.null`, {
      user_id: ids[user.key],
    });
    await api.rest(
      "POST",
      "user_roles?on_conflict=user_id,role",
      { user_id: ids[user.key], role: "builder" },
      { prefer: "resolution=ignore-duplicates,return=minimal" },
    );
    linked += 1;
  }
  log(`builders: ${linked} linked`);
}

async function addListingPhotos(api, images, { log }) {
  const listings = await api.rest(
    "GET",
    `properties?select=id,owner_id,status,featured,submitted_at&short_id=like.${SEED_LISTING_PREFIX}*&order=short_id`,
  );
  if (!listings || listings.length === 0) {
    throw new SeedRefusal(
      "no seeded listings found; load supabase/seed.sql first (supabase db reset)",
    );
  }
  const withPhotos = new Set(
    (
      await api.rest(
        "GET",
        `listing_media?select=listing_id&listing_id=in.(${listings.map((listing) => listing.id).join(",")})`,
      )
    ).map((row) => row.listing_id),
  );
  let added = 0;
  let restored = 0;
  for (const [index, listing] of listings.entries()) {
    if (withPhotos.has(listing.id)) continue;
    const plan = planListingMedia({
      listingId: listing.id,
      ownerId: listing.owner_id,
      images,
      offset: index,
    });
    for (const photo of plan) await api.upload("listing-photos", photo.path, photo.image);
    await api.rest(
      "POST",
      "listing_media",
      plan.map((photo) => photo.record),
      { prefer: "return=minimal" },
    );
    added += plan.length;
    const restore = restoreValues(listing);
    if (restore) {
      await api.rest("PATCH", `properties?id=eq.${listing.id}`, restore, {
        prefer: "return=minimal",
      });
      restored += 1;
    }
  }
  log(`listings: ${added} photos added, ${restored} approved listings put back`);
}

async function addProjectImages(api, images, { log }) {
  const projects = (await api.rest("GET", "projects?select=id,images&limit=200")).filter(
    (project) => project.id.startsWith(SEED_PROJECT_PREFIX),
  );
  let added = 0;
  for (const [index, project] of projects.entries()) {
    if (project.images.length > 0) continue;
    const plan = planProjectImages({ projectId: project.id, images, offset: index });
    for (const file of plan) await api.upload("project-media", file.path, file.image);
    await api.rest(
      "PATCH",
      `projects?id=eq.${project.id}`,
      { images: plan.map((file) => file.path) },
      { prefer: "return=minimal" },
    );
    added += plan.length;
  }
  log(`projects: ${added} images added`);
}

/**
 * Seeds users, photos and project images. `fetch` is injected so a test can stand in for the server.
 * Safe to run again: users are found, and a listing or project that already has pictures is skipped.
 */
export async function runSeedDev({
  fetch: fetchImpl,
  url,
  key,
  hosted = false,
  allowedUrl,
  log = () => {},
  images,
}) {
  const { local } = assertSeedTarget({ url, hosted, allowedUrl });
  if (typeof key !== "string" || key.length < 20) throw new SeedRefusal("no service key was given");
  const api = client({ fetch: fetchImpl, url, key });
  const pictures = images ?? buildSampleImages();
  const ids = await ensureUsers(api, { local, log });
  await linkBuilders(api, ids, { log });
  await addListingPhotos(api, pictures, { log });
  await addProjectImages(api, pictures, { log });
  return { users: Object.keys(ids).length };
}
