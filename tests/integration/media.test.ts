import { randomInt, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bytes, jpeg, png } from "@/features/media/__tests__/image-fixtures";
import { adminClient } from "./support/clients";
import { removeTestUser, signInTestCustomer, type TestUser } from "./support/users";

// Outside a request there is no cookie or header store; the stores below take their clients directly.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ getAll: () => [], set: () => undefined }),
}));

const { photoCallerStore, createPhotoServerStore, createSweepStore } =
  await import("@/features/media/service");
const { acceptPhoto, dropPhoto, issuePhotoUpload } = await import("@/features/media/media-service");
const { sweepOrphanPhotos } = await import("@/features/media/sweep");
const { PHOTO_BUCKET } = await import("@/features/media/constants");

const RUN = randomUUID().slice(0, 8);
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const madeUpShortId = () =>
  Array.from({ length: 8 }, () => ALPHABET.charAt(randomInt(ALPHABET.length))).join("");

describe("IT-media: the listing photo pipeline against a real database and storage (S6-T01, ADR-015)", () => {
  let owner: TestUser;
  let listingId: string;
  let otherListingId: string;
  let otherOwnerId: string;
  const server = createPhotoServerStore(randomUUID());
  const uploaded: string[] = [];

  async function addListing(forUser: string, name: string): Promise<string> {
    const { data, error } = await adminClient()
      .from("properties")
      .insert({
        owner_id: forUser,
        short_id: madeUpShortId(),
        slug: `it-media-${name}-${RUN}`,
        status: "draft",
        title: `IT media ${name} ${RUN}`,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Could not create the ${name} listing (${error.code})`);
    return data.id;
  }

  /** Asks for an address as the owner and uploads `file` to it, the way the browser does. */
  async function upload(
    file: Uint8Array<ArrayBuffer>,
    mime: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  ) {
    const caller = photoCallerStore(owner.client);
    const issued = await issuePhotoUpload(caller, {
      input: { listingId, mime, bytes: file.byteLength },
      userId: owner.userId,
      newId: () => randomUUID(),
    });
    const sent = await owner.client.storage
      .from(PHOTO_BUCKET)
      .uploadToSignedUrl(issued.path, issued.token, new Blob([file], { type: mime }), {
        contentType: mime,
      });
    if (sent.error) throw new Error(`Could not upload (${sent.error.message})`);
    uploaded.push(issued.path);
    return issued.path;
  }

  /**
   * Leaves a file in the bucket that is never finished, the way a closed tab does: signed straight
   * against the bucket (its own rules still apply), with no address asked for, so it works even when
   * the listing already holds six photos.
   */
  async function leaveUnfinished(file: Uint8Array<ArrayBuffer>): Promise<string> {
    const path = `${owner.userId}/${listingId}/${randomUUID()}.jpg`;
    const signed = await owner.client.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
    if (signed.error) throw new Error(`Could not sign (${signed.error.message})`);
    const sent = await owner.client.storage
      .from(PHOTO_BUCKET)
      .uploadToSignedUrl(path, signed.data.token, new Blob([file], { type: "image/jpeg" }), {
        contentType: "image/jpeg",
      });
    if (sent.error) throw new Error(`Could not upload (${sent.error.message})`);
    return path;
  }

  const accept = (path: string) =>
    acceptPhoto(photoCallerStore(owner.client), server, {
      input: { listingId, path },
      userId: owner.userId,
    });

  const storedNames = async (): Promise<string[]> => {
    const { data, error } = await adminClient()
      .storage.from(PHOTO_BUCKET)
      .list(`${owner.userId}/${listingId}`);
    if (error) throw new Error("Could not list the bucket");
    return data.map((object) => `${owner.userId}/${listingId}/${object.name}`);
  };

  const photoRows = async () => {
    const { data, error } = await adminClient()
      .from("listing_media")
      .select("id, storage_path, is_cover, position")
      .eq("listing_id", listingId)
      .order("position");
    if (error) throw new Error("Could not read the photos");
    return data;
  };

  beforeAll(async () => {
    owner = await signInTestCustomer();
    const other = await adminClient().auth.admin.createUser({
      email: `it-media-other-${RUN}@example.test`,
      email_confirm: true,
    });
    if (other.error || !other.data.user) throw new Error("Could not create the other owner");
    otherOwnerId = other.data.user.id;
    listingId = await addListing(owner.userId, "mine");
    otherListingId = await addListing(otherOwnerId, "theirs");
  });

  afterAll(async () => {
    const admin = adminClient();
    const names = await storedNames().catch(() => []);
    if (names.length > 0) await admin.storage.from(PHOTO_BUCKET).remove(names);
    await admin.from("internal_cron_tokens").delete().eq("name", "media_sweep");
    await admin.from("properties").delete().in("id", [listingId, otherListingId]);
    await admin.auth.admin.deleteUser(otherOwnerId);
    await removeTestUser();
  });

  it("takes a good photo from address to row: the server reads the file and records its real size", async () => {
    const path = await upload(jpeg({ width: 1600, height: 1200 }));
    const done = await accept(path);
    expect(done.path).toBe(path);
    const rows = await photoRows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ storage_path: path, is_cover: true, position: 0 });
    const { data } = await adminClient()
      .from("listing_media")
      .select("width, height, mime, bytes")
      .eq("id", done.photoId)
      .single();
    expect(data).toMatchObject({ width: 1600, height: 1200, mime: "image/jpeg" });
  });

  it("refuses an SVG that was uploaded as a JPEG, and deletes the file", async () => {
    const svg = bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const path = await upload(svg);
    await expect(accept(path)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await storedNames()).not.toContain(path);
    expect((await photoRows()).map((row) => row.storage_path)).not.toContain(path);
  });

  it("refuses a JPEG that still carries camera metadata, and deletes the file", async () => {
    const path = await upload(jpeg({ width: 1200, height: 800, exif: true }));
    await expect(accept(path)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await storedNames()).not.toContain(path);
  });

  it("refuses a PNG uploaded under a JPEG name (the declared type does not match the bytes)", async () => {
    const path = await upload(png({ width: 800, height: 600 }), "image/jpeg");
    await expect(accept(path)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await storedNames()).not.toContain(path);
  });

  it("refuses a request for a file over 10 MB before an address is issued", async () => {
    const issue = issuePhotoUpload(photoCallerStore(owner.client), {
      input: { listingId, mime: "image/jpeg", bytes: 10 * 1024 * 1024 + 1 },
      userId: owner.userId,
      newId: () => randomUUID(),
    });
    await expect(issue).rejects.toMatchObject({ code: "VALIDATION" });
  });

  it("will not issue an address for someone else's listing, and the bucket refuses their folder", async () => {
    await expect(
      issuePhotoUpload(photoCallerStore(owner.client), {
        input: { listingId: otherListingId, mime: "image/jpeg", bytes: 1000 },
        userId: owner.userId,
        newId: () => randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const stranger = await owner.client.storage
      .from(PHOTO_BUCKET)
      .createSignedUploadUrl(`${otherOwnerId}/${otherListingId}/${randomUUID()}.jpg`);
    expect(stranger.error).not.toBeNull();
    const intoTheirListing = await owner.client.storage
      .from(PHOTO_BUCKET)
      .createSignedUploadUrl(`${owner.userId}/${otherListingId}/${randomUUID()}.jpg`);
    expect(intoTheirListing.error).not.toBeNull();
  });

  it("stops at six photos: the seventh is refused and its file deleted", async () => {
    for (let count = (await photoRows()).length; count < 6; count += 1) {
      await accept(await upload(jpeg({ width: 800 + count, height: 600 })));
    }
    expect(await photoRows()).toHaveLength(6);
    // The address itself is refused once the listing is full ...
    await expect(
      issuePhotoUpload(photoCallerStore(owner.client), {
        input: { listingId, mime: "image/jpeg", bytes: 1000 },
        userId: owner.userId,
        newId: () => randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    // ... and a file that gets in anyway (an address issued earlier) is refused by the database.
    const early = `${owner.userId}/${listingId}/${randomUUID()}.jpg`;
    const signed = await owner.client.storage.from(PHOTO_BUCKET).createSignedUploadUrl(early);
    if (signed.error) throw new Error("Could not sign");
    await owner.client.storage
      .from(PHOTO_BUCKET)
      .uploadToSignedUrl(
        early,
        signed.data.token,
        new Blob([jpeg({ width: 900, height: 700 })], { type: "image/jpeg" }),
        {
          contentType: "image/jpeg",
        },
      );
    await expect(accept(early)).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await storedNames()).not.toContain(early);
    expect(await photoRows()).toHaveLength(6);
  });

  it("removes a photo: the row and the file go, and the next photo becomes the cover", async () => {
    const before = await photoRows();
    const cover = before.find((row) => row.is_cover);
    if (!cover) throw new Error("expected a cover");
    const done = await dropPhoto(photoCallerStore(owner.client), server, {
      input: { listingId, photoId: cover.id },
    });
    expect(done.shortId).toMatch(/^[a-hjkmnp-z2-9]{8}$/);
    const after = await photoRows();
    expect(after).toHaveLength(5);
    expect(after.filter((row) => row.is_cover)).toHaveLength(1);
    expect(after.some((row) => row.id === cover.id)).toBe(false);
    expect(await storedNames()).not.toContain(cover.storage_path);
  });

  it("will not let the owner remove a photo of someone else's listing", async () => {
    const { data } = await adminClient().from("listing_media").select("id").limit(1);
    const photoId = data?.[0]?.id ?? randomUUID();
    await expect(
      dropPhoto(photoCallerStore(owner.client), server, {
        input: { listingId: otherListingId, photoId },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("sends an approved listing back to review when a photo is added (policy C)", async () => {
    const admin = adminClient();
    // Free a place first: the listing may hold six.
    const rows = await photoRows();
    if (rows.length >= 6 && rows[0]) {
      await dropPhoto(photoCallerStore(owner.client), server, {
        input: { listingId, photoId: rows[0].id },
      });
    }
    // The listing must be complete before it can be anything but a draft.
    const complete = await admin
      .from("properties")
      .update({
        listing_type: "sale",
        property_type: "apartment",
        description: "A made-up home for the photo tests.",
        price: 5_000_000,
        area_sqft: 900,
        locality: "Integration Test Locality",
        city: "Chennai",
        state: "Tamil Nadu",
        pincode: "600001",
        address: "1 Test Street",
        location: "SRID=4326;POINT(80.27074 13.08274)",
      })
      .eq("id", listingId);
    if (complete.error) throw new Error(`Could not complete the listing (${complete.error.code})`);
    for (const next of ["pending", "approved"] as const) {
      const moved = await admin.from("properties").update({ status: next }).eq("id", listingId);
      if (moved.error)
        throw new Error(`Could not move the listing to ${next} (${moved.error.code})`);
    }
    await accept(await upload(jpeg({ width: 1000, height: 750 })));
    const { data } = await admin.from("properties").select("status").eq("id", listingId).single();
    expect(data?.status).toBe("pending");
  });

  describe("the sweep", () => {
    const token = "test-token-not-real-0123456789abcdef";

    it("lists a file with no photo row and leaves recorded photos alone", async () => {
      const admin = adminClient();
      const lost = await leaveUnfinished(jpeg({ width: 640, height: 480 }));
      // Zero hours means "everything older than now", so the new file counts without waiting a day.
      const { data, error } = await admin.rpc("orphan_listing_photos", { p_older_than_hours: 0 });
      expect(error).toBeNull();
      const names = (data ?? []).map((row) => row.name);
      expect(names).toContain(lost);
      const claimed = (await photoRows()).map((row) => row.storage_path);
      for (const path of claimed) expect(names).not.toContain(path);
      // The default age (24 hours) does not list a file uploaded a moment ago.
      const fresh = await admin.rpc("orphan_listing_photos");
      expect((fresh.data ?? []).map((row) => row.name)).not.toContain(lost);
    });

    it("lets only the job's token in, and removes the files through the storage service", async () => {
      const admin = adminClient();
      const store = createSweepStore(randomUUID());
      await admin.from("internal_cron_tokens").delete().eq("name", "media_sweep");
      expect(await store.readToken()).toBeNull();
      await expect(sweepOrphanPhotos(store, token)).resolves.toEqual({ allowed: false });

      const inserted = await admin
        .from("internal_cron_tokens")
        .insert({ name: "media_sweep", token });
      if (inserted.error) throw new Error(`Could not set the token (${inserted.error.code})`);
      expect(await store.readToken()).toBe(token);
      await expect(sweepOrphanPhotos(store, "wrong-token")).resolves.toEqual({ allowed: false });

      const lost = await leaveUnfinished(jpeg({ width: 320, height: 240 }));
      const listed = await admin.rpc("orphan_listing_photos", { p_older_than_hours: 0 });
      const names = (listed.data ?? []).map((row) => row.name);
      expect(names).toContain(lost);
      await store.removeObjects(names.filter((name) => name === lost));
      expect(await storedNames()).not.toContain(lost);
    });
  });
});
