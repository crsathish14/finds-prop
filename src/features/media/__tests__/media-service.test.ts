import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import {
  acceptPhoto,
  dropPhoto,
  issuePhotoUpload,
  mapMediaWriteError,
  type OwnListing,
  type PhotoCallerStore,
  type PhotoServerStore,
} from "../media-service";
import { PHOTO_MAX_BYTES } from "../constants";
import { bytes, jpeg, png, webpLossy } from "./image-fixtures";

const USER = "00000000-0000-4000-8000-0000000000a1";
const OTHER_USER = "00000000-0000-4000-8000-0000000000a2";
const LISTING = "00000000-0000-4000-9000-000000000001";
const FILE = "00000000-0000-4000-8000-0000000000f1";
const PHOTO = "00000000-0000-4000-8000-0000000000e1";
const OWN: OwnListing = { id: LISTING, shortId: "abcd2345", status: "draft" };

function caller(overrides: Partial<PhotoCallerStore> & { listing?: OwnListing | null } = {}) {
  const calls: string[] = [];
  const store: PhotoCallerStore = {
    readOwnListing: async () => {
      calls.push("readOwnListing");
      return overrides.listing === undefined ? OWN : overrides.listing;
    },
    countPhotos: async () => {
      calls.push("countPhotos");
      return 0;
    },
    createSignedUpload: async (path) => {
      calls.push(`sign:${path}`);
      return { token: "upload-token" };
    },
    deletePhotoRow: async () => ({ storagePath: `${USER}/${LISTING}/${FILE}.jpg` }),
    ...overrides,
  };
  return { store, calls };
}

function server(file: Uint8Array | null, overrides: Partial<PhotoServerStore> = {}) {
  const calls: string[] = [];
  const store: PhotoServerStore = {
    download: async (path) => {
      calls.push(`download:${path}`);
      return file;
    },
    deleteObject: async (path) => {
      calls.push(`delete:${path}`);
    },
    finalize: async (row) => {
      calls.push(`finalize:${row.mime}:${row.width}x${row.height}`);
      return PHOTO;
    },
    ...overrides,
  };
  return { store, calls };
}

const failure = async (run: () => Promise<unknown>): Promise<ActionError> => {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
};

describe("UT-media-service: asking for an upload address (plan 07 section 7: authorise first)", () => {
  const input = { listingId: LISTING, mime: "image/jpeg" as const, bytes: 400_000 };

  it("names the file itself, in the caller's own folder, and returns the one-time token", async () => {
    const { store, calls } = caller();
    const result = await issuePhotoUpload(store, { input, userId: USER, newId: () => FILE });
    expect(result).toEqual({ path: `${USER}/${LISTING}/${FILE}.jpg`, token: "upload-token" });
    expect(calls).toContain(`sign:${USER}/${LISTING}/${FILE}.jpg`);
  });

  it("uses the extension of the declared type", async () => {
    const { store } = caller();
    const webp = await issuePhotoUpload(store, {
      input: { ...input, mime: "image/webp" },
      userId: USER,
      newId: () => FILE,
    });
    const pngFile = await issuePhotoUpload(store, {
      input: { ...input, mime: "image/png" },
      userId: USER,
      newId: () => FILE,
    });
    expect(webp.path.endsWith(".webp")).toBe(true);
    expect(pngFile.path.endsWith(".png")).toBe(true);
  });

  it("refuses a listing that is not the caller's before it counts or signs anything", async () => {
    const { store, calls } = caller({ listing: null });
    const error = await failure(() =>
      issuePhotoUpload(store, { input, userId: USER, newId: () => FILE }),
    );
    expect(error.code).toBe("NOT_FOUND");
    expect(calls).toEqual(["readOwnListing"]);
  });

  it.each(["sold", "rented"])("refuses a %s listing", async (status) => {
    const { store, calls } = caller({ listing: { ...OWN, status } });
    const error = await failure(() =>
      issuePhotoUpload(store, { input, userId: USER, newId: () => FILE }),
    );
    expect(error.code).toBe("FORBIDDEN");
    expect(calls.some((call) => call.startsWith("sign:"))).toBe(false);
  });

  it.each(["draft", "pending", "rejected", "approved"])("accepts a %s listing", async (status) => {
    const { store } = caller({ listing: { ...OWN, status } });
    await expect(
      issuePhotoUpload(store, { input, userId: USER, newId: () => FILE }),
    ).resolves.toMatchObject({ token: "upload-token" });
  });

  it("says the limit is reached when the listing already has six photos", async () => {
    const { store, calls } = caller({ countPhotos: async () => 6 });
    const error = await failure(() =>
      issuePhotoUpload(store, { input, userId: USER, newId: () => FILE }),
    );
    expect(error.fieldErrors?.photo).toEqual([
      { key: "validation.photoLimit", values: { maximum: 6 } },
    ]);
    expect(calls.some((call) => call.startsWith("sign:"))).toBe(false);
  });

  it("still takes a sixth photo", async () => {
    const { store } = caller({ countPhotos: async () => 5 });
    await expect(
      issuePhotoUpload(store, { input, userId: USER, newId: () => FILE }),
    ).resolves.toMatchObject({ token: "upload-token" });
  });

  it("refuses a file over 10 MB and names the limit", async () => {
    const { store } = caller();
    const error = await failure(() =>
      issuePhotoUpload(store, {
        input: { ...input, bytes: PHOTO_MAX_BYTES + 1 },
        userId: USER,
        newId: () => FILE,
      }),
    );
    expect(error.fieldErrors?.photo).toEqual([
      { key: "validation.photoTooLarge", values: { maximum: 10 } },
    ]);
  });
});

describe("UT-media-service: finishing an upload (the server reads the stored file itself)", () => {
  const path = `${USER}/${LISTING}/${FILE}.jpg`;
  const input = { listingId: LISTING, path };
  const good = jpeg({ width: 1600, height: 1200 });

  it("records a good photo with the size read from the file and returns the home's public id", async () => {
    const { store: callerStore } = caller();
    const { store, calls } = server(good);
    const done = await acceptPhoto(callerStore, store, { input, userId: USER });
    expect(done).toEqual({ photoId: PHOTO, path, shortId: "abcd2345" });
    expect(calls).toEqual([`download:${path}`, "finalize:image/jpeg:1600x1200"]);
  });

  it("takes a PNG and a WebP stored under their own extensions", async () => {
    const { store: callerStore } = caller();
    const pngPath = `${USER}/${LISTING}/${FILE}.png`;
    const webpPath = `${USER}/${LISTING}/${FILE}.webp`;
    await expect(
      acceptPhoto(callerStore, server(png({ width: 800, height: 600 })).store, {
        input: { listingId: LISTING, path: pngPath },
        userId: USER,
      }),
    ).resolves.toMatchObject({ path: pngPath });
    await expect(
      acceptPhoto(callerStore, server(webpLossy(800, 600)).store, {
        input: { listingId: LISTING, path: webpPath },
        userId: USER,
      }),
    ).resolves.toMatchObject({ path: webpPath });
  });

  it("refuses a listing that is not the caller's without reading any file", async () => {
    const { store: callerStore } = caller({ listing: null });
    const { store, calls } = server(good);
    const error = await failure(() => acceptPhoto(callerStore, store, { input, userId: USER }));
    expect(error.code).toBe("NOT_FOUND");
    expect(calls).toEqual([]);
  });

  it.each([
    ["another user's folder", `${OTHER_USER}/${LISTING}/${FILE}.jpg`],
    ["another listing", `${USER}/00000000-0000-4000-9000-000000000002/${FILE}.jpg`],
    ["a name the server did not issue", `${USER}/${LISTING}/holiday.jpg`],
    ["a path that climbs out of the folder", `${USER}/${LISTING}/../${OTHER_USER}/${FILE}.jpg`],
    ["an extension the pipeline does not use", `${USER}/${LISTING}/${FILE}.svg`],
  ])("refuses %s without reading or deleting anything", async (_label, badPath) => {
    const { store: callerStore } = caller();
    const { store, calls } = server(good);
    const error = await failure(() =>
      acceptPhoto(callerStore, store, {
        input: { listingId: LISTING, path: badPath },
        userId: USER,
      }),
    );
    expect(error.code).toBe("FORBIDDEN");
    expect(calls).toEqual([]);
  });

  it("says not found, and deletes nothing, when the file was never uploaded", async () => {
    const { store: callerStore } = caller();
    const { store, calls } = server(null);
    const error = await failure(() => acceptPhoto(callerStore, store, { input, userId: USER }));
    expect(error.code).toBe("NOT_FOUND");
    expect(calls).toEqual([`download:${path}`]);
  });

  const refusals: [string, Uint8Array, string][] = [
    [
      "an SVG sent as a JPEG",
      bytes('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      "validation.photoType",
    ],
    [
      "an HTML page sent as a JPEG",
      bytes("<html><body>hello</body></html>"),
      "validation.photoType",
    ],
    [
      "a PNG stored under a .jpg name (declared type does not match)",
      png({ width: 800, height: 600 }),
      "validation.photoType",
    ],
    [
      "a JPEG that still has camera metadata",
      jpeg({ width: 800, height: 600, exif: true }),
      "validation.photoNotPrepared",
    ],
    ["a JPEG cut short", jpeg({ width: 800, height: 600, cut: true }), "validation.photoType"],
    ["a photo that is too small", jpeg({ width: 50, height: 50 }), "validation.photoDimensions"],
    [
      "a photo that is too large in pixels",
      jpeg({ width: 6000, height: 4000 }),
      "validation.photoDimensions",
    ],
  ];
  it.each(refusals)("refuses %s and deletes the file", async (_label, file, key) => {
    const { store: callerStore } = caller();
    const { store, calls } = server(file);
    const error = await failure(() => acceptPhoto(callerStore, store, { input, userId: USER }));
    expect(error.code).toBe("VALIDATION");
    expect(error.fieldErrors?.photo?.[0]?.key).toBe(key);
    expect(calls).toContain(`delete:${path}`);
    expect(calls.some((call) => call.startsWith("finalize:"))).toBe(false);
  });

  it("refuses a stored file over 10 MB and deletes it", async () => {
    const { store: callerStore } = caller();
    const { store, calls } = server(new Uint8Array(PHOTO_MAX_BYTES + 1));
    const error = await failure(() => acceptPhoto(callerStore, store, { input, userId: USER }));
    expect(error.fieldErrors?.photo?.[0]?.key).toBe("validation.photoTooLarge");
    expect(calls).toContain(`delete:${path}`);
  });

  it("still answers with the real reason when the refused file cannot be deleted (the sweeper takes it)", async () => {
    const { store: callerStore } = caller();
    const { store } = server(bytes("not an image"), {
      deleteObject: async () => {
        throw new Error("storage down");
      },
    });
    const error = await failure(() => acceptPhoto(callerStore, store, { input, userId: USER }));
    expect(error.fieldErrors?.photo?.[0]?.key).toBe("validation.photoType");
  });

  it("deletes the file and passes the limit message on when the database refuses a seventh photo", async () => {
    const { store: callerStore } = caller();
    const { store, calls } = server(good, {
      finalize: async () => {
        throw mapMediaWriteError({ code: "P0001", message: "listing_media.limit" });
      },
    });
    const error = await failure(() => acceptPhoto(callerStore, store, { input, userId: USER }));
    expect(error.fieldErrors?.photo).toEqual([
      { key: "validation.photoLimit", values: { maximum: 6 } },
    ]);
    expect(calls).toContain(`delete:${path}`);
  });
});

describe("UT-media-service: removing a photo", () => {
  it("removes the row first, then the file, and returns the home's public id", async () => {
    const order: string[] = [];
    const { store: callerStore } = caller({
      deletePhotoRow: async () => {
        order.push("row");
        return { storagePath: `${USER}/${LISTING}/${FILE}.jpg` };
      },
    });
    const { store } = server(null, {
      deleteObject: async () => {
        order.push("file");
      },
    });
    const done = await dropPhoto(callerStore, store, {
      input: { listingId: LISTING, photoId: PHOTO },
    });
    expect(done).toEqual({ shortId: "abcd2345" });
    expect(order).toEqual(["row", "file"]);
  });

  it("says not found for a listing that is not the caller's, and touches nothing", async () => {
    const { store: callerStore } = caller({
      listing: null,
      deletePhotoRow: async () => {
        throw new Error("must not be called");
      },
    });
    const error = await failure(() =>
      dropPhoto(callerStore, server(null).store, { input: { listingId: LISTING, photoId: PHOTO } }),
    );
    expect(error.code).toBe("NOT_FOUND");
  });

  it("says not found when the database removed no row (not this listing's photo, or the listing closed)", async () => {
    const { store: callerStore } = caller({ deletePhotoRow: async () => null });
    const { store, calls } = server(null);
    const error = await failure(() =>
      dropPhoto(callerStore, store, { input: { listingId: LISTING, photoId: PHOTO } }),
    );
    expect(error.code).toBe("NOT_FOUND");
    expect(calls).toEqual([]);
  });

  it("keeps the success, and says so, when the file cannot be deleted (the sweeper takes it)", async () => {
    const { store: callerStore } = caller();
    const { store } = server(null, {
      deleteObject: async () => {
        throw new Error("storage down");
      },
    });
    const left: string[] = [];
    await expect(
      dropPhoto(callerStore, store, {
        input: { listingId: LISTING, photoId: PHOTO },
        onFileLeft: (path) => left.push(path),
      }),
    ).resolves.toEqual({ shortId: "abcd2345" });
    expect(left).toEqual([`${USER}/${LISTING}/${FILE}.jpg`]);
  });

  it("refuses a sold listing", async () => {
    const { store: callerStore } = caller({ listing: { ...OWN, status: "sold" } });
    const error = await failure(() =>
      dropPhoto(callerStore, server(null).store, { input: { listingId: LISTING, photoId: PHOTO } }),
    );
    expect(error.code).toBe("FORBIDDEN");
  });
});

describe("UT-media-service: what the database says becomes the closed set of errors", () => {
  it("maps each answer", () => {
    expect(
      mapMediaWriteError({ code: "P0001", message: "listing_media.limit" }).fieldErrors?.photo?.[0]
        ?.key,
    ).toBe("validation.photoLimit");
    expect(mapMediaWriteError({ code: "P0002", message: "media.listing_not_found" }).code).toBe(
      "NOT_FOUND",
    );
    expect(mapMediaWriteError({ code: "P0002", message: "media.object_missing" }).code).toBe(
      "NOT_FOUND",
    );
    expect(mapMediaWriteError({ code: "42501", message: "media.listing_closed" }).code).toBe(
      "FORBIDDEN",
    );
    expect(mapMediaWriteError({ code: "22023", message: "media.path" }).code).toBe("VALIDATION");
    expect(mapMediaWriteError({ code: "XX000" }).code).toBe("INTERNAL");
    expect(mapMediaWriteError({}).code).toBe("INTERNAL");
  });
});
