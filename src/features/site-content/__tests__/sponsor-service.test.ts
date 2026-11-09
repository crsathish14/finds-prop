import { describe, expect, it, vi } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { sponsorsInputSchema, type SponsorsInput } from "../sponsor-schemas";
import { saveSponsorsContent, type SponsorStore } from "../sponsor-service";
import { jpeg, notAPicture, png, webpLossless } from "./sponsor-fixtures";

const ID = "ad-one";
const path = (name: string, id = ID) => `sponsors/${id}/${name}`;

/** A bucket with some files in it, and a list of stored sponsors; every call is recorded. */
function standIn(options: {
  files?: Record<string, Uint8Array>;
  stored?: unknown[];
  removeFails?: boolean;
}) {
  const calls = { fetched: [] as string[], written: [] as unknown[][], removed: [] as string[][] };
  const store: SponsorStore = {
    readAds: () => Promise.resolve(options.stored ?? []),
    fetchImage: (file) => {
      calls.fetched.push(file);
      return Promise.resolve(options.files?.[file] ?? null);
    },
    write: (ads) => {
      calls.written.push(ads);
      return Promise.resolve();
    },
    removeFiles: (files) => {
      calls.removed.push([...files]);
      return options.removeFails ? Promise.reject(new Error("no")) : Promise.resolve();
    },
  };
  return { store, calls };
}

const input = (sponsors: Record<string, unknown>[]): SponsorsInput =>
  sponsorsInputSchema.parse({ sponsors });

const base = (over: Record<string, unknown> = {}) => ({
  id: ID,
  advertiser: "Sample Developer",
  alt: "Sample Developer: new launch apartments.",
  href: "https://sampledeveloper.example",
  active: true,
  ...over,
});

const GOOD_FILES = {
  [path("sd.png")]: png(1940, 180, 90_000),
  [path("sc.jpg")]: jpeg(640, 200, 40_000),
  [path("pd.webp")]: webpLossless(1048, 988, 110_000),
  [path("pc.png")]: png(1280, 640, 80_000),
};

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof ActionError) return error;
    throw error;
  }
  throw new Error("expected the call to fail");
}

describe("UT-sponsors-save: the rules of saving the sponsors (S7-T11)", () => {
  it("measures each new picture from its file and stores what it found, not what was claimed", async () => {
    const { store, calls } = standIn({ files: GOOD_FILES });
    const done = await saveSponsorsContent(
      store,
      input([
        base({
          strip: { desktop: path("sd.png"), compact: path("sc.jpg") },
          panel: { desktop: path("pd.webp"), compact: path("pc.png") },
        }),
      ]),
    );
    expect(done).toEqual({ count: 1, active: 1 });
    expect(calls.written).toHaveLength(1);
    expect(calls.written[0]).toEqual([
      {
        id: ID,
        advertiser: "Sample Developer",
        active: true,
        placements: ["hero", "results"],
        alt: "Sample Developer: new launch apartments.",
        href: "https://sampledeveloper.example",
        strip: {
          desktop: { path: path("sd.png"), width: 1940, height: 180, bytes: 90_000 },
          compact: { path: path("sc.jpg"), width: 640, height: 200, bytes: 40_000 },
        },
        panel: {
          desktop: { path: path("pd.webp"), width: 1048, height: 988, bytes: 110_000 },
          compact: { path: path("pc.png"), width: 1280, height: 640, bytes: 80_000 },
        },
      },
    ]);
  });

  it("saves a sponsor with no pictures (it is stored, and never shown) and keeps the order", async () => {
    const { store, calls } = standIn({});
    const done = await saveSponsorsContent(
      store,
      input([base({ id: "ad-b", active: false }), base({ id: "ad-a", advertiser: "Another" })]),
    );
    expect(done).toEqual({ count: 2, active: 1 });
    expect((calls.written[0] as { id: string }[]).map((ad) => ad.id)).toEqual(["ad-b", "ad-a"]);
    expect(calls.fetched).toEqual([]);
  });

  it("writes an empty list when the last sponsor is deleted", async () => {
    const { store, calls } = standIn({});
    expect(await saveSponsorsContent(store, input([]))).toEqual({ count: 0, active: 0 });
    expect(calls.written).toEqual([[]]);
  });

  it("refuses a picture that is not there, naming its slot, and writes nothing", async () => {
    const { store, calls } = standIn({ files: {} });
    const failure = await failureOf(() =>
      saveSponsorsContent(
        store,
        input([base({ strip: { desktop: path("sd.png"), compact: path("sc.jpg") } })]),
      ),
    );
    expect(failure.code).toBe("VALIDATION");
    expect(failure.fieldErrors).toEqual({
      "sponsors.0.strip.desktop": [{ key: "validation.sponsorImageMissing" }],
      "sponsors.0.strip.compact": [{ key: "validation.sponsorImageMissing" }],
    });
    expect(calls.written).toEqual([]);
    expect(calls.removed).toEqual([]);
  });

  it("gives each refused picture its own reason with the numbers the words need", async () => {
    const { store, calls } = standIn({
      files: {
        [path("sd.png")]: notAPicture(),
        [path("sc.jpg")]: jpeg(640, 200, 200 * 1024),
        [path("pd.webp")]: webpLossless(300, 150, 1000),
        [path("pc.png")]: png(1280, 1280, 1000),
      },
    });
    const failure = await failureOf(() =>
      saveSponsorsContent(
        store,
        input([
          base({
            strip: { desktop: path("sd.png"), compact: path("sc.jpg") },
            panel: { desktop: path("pd.webp"), compact: path("pc.png") },
          }),
        ]),
      ),
    );
    expect(failure.fieldErrors).toEqual({
      "sponsors.0.strip.desktop": [{ key: "validation.sponsorImageType" }],
      "sponsors.0.strip.compact": [
        { key: "validation.sponsorImageSize", values: { maximum: 150 } },
      ],
      "sponsors.0.panel.desktop": [
        { key: "validation.sponsorImageSmall", values: { width: 1048, height: 988 } },
      ],
      "sponsors.0.panel.compact": [{ key: "validation.sponsorImageShape" }],
    });
    expect(calls.written).toEqual([]);
  });

  it("does not read a picture the stored list already holds, and keeps what it measured before", async () => {
    const stored = [
      {
        ...base(),
        placements: ["hero", "results"],
        strip: {
          desktop: { path: path("sd.png"), width: 1940, height: 180, bytes: 90_000 },
          compact: { path: path("sc.jpg"), width: 640, height: 200, bytes: 40_000 },
        },
      },
    ];
    const { store, calls } = standIn({ stored });
    await saveSponsorsContent(
      store,
      input([
        base({
          advertiser: "Renamed",
          strip: { desktop: path("sd.png"), compact: path("sc.jpg") },
        }),
      ]),
    );
    expect(calls.fetched).toEqual([]);
    expect((calls.written[0] as { strip: unknown; advertiser: string }[])[0]).toMatchObject({
      advertiser: "Renamed",
      strip: { desktop: { width: 1940, bytes: 90_000 } },
    });
    expect(calls.removed).toEqual([]);
  });

  it("reads a picture stored before the editor measured weights, once, and records its weight", async () => {
    const stored = [
      {
        id: ID,
        active: true,
        placements: ["hero"],
        alt: "x",
        href: "https://a.example",
        strip: {
          desktop: { path: path("sd.png"), width: 1940, height: 180 },
          compact: { path: path("sc.jpg"), width: 640, height: 200 },
        },
      },
    ];
    const { store, calls } = standIn({ stored, files: GOOD_FILES });
    await saveSponsorsContent(
      store,
      input([base({ strip: { desktop: path("sd.png"), compact: path("sc.jpg") } })]),
    );
    expect(calls.fetched.sort()).toEqual([path("sc.jpg"), path("sd.png")]);
    expect(
      (calls.written[0] as { strip: { desktop: { bytes: number } } }[])[0]?.strip.desktop.bytes,
    ).toBe(90_000);
  });

  it("takes the files no sponsor uses any more out of the bucket after the list is saved", async () => {
    const stored = [
      {
        ...base(),
        placements: ["hero", "results"],
        strip: {
          desktop: { path: path("old-d.png"), width: 1940, height: 180, bytes: 1 },
          compact: { path: path("old-c.png"), width: 640, height: 200, bytes: 1 },
        },
      },
      {
        ...base({ id: "ad-gone" }),
        placements: ["hero"],
        panel: {
          desktop: { path: path("gone-d.png", "ad-gone"), width: 1048, height: 988, bytes: 1 },
          compact: { path: path("gone-c.png", "ad-gone"), width: 1280, height: 640, bytes: 1 },
        },
      },
    ];
    const { store, calls } = standIn({ stored, files: GOOD_FILES });
    await saveSponsorsContent(
      store,
      input([base({ strip: { desktop: path("sd.png"), compact: path("sc.jpg") } })]),
    );
    expect(calls.removed).toHaveLength(1);
    expect(calls.removed[0]?.sort()).toEqual(
      [
        path("gone-c.png", "ad-gone"),
        path("gone-d.png", "ad-gone"),
        path("old-c.png"),
        path("old-d.png"),
      ].sort(),
    );
  });

  it("does not take files away when the save is refused", async () => {
    const stored = [
      {
        ...base(),
        placements: ["hero"],
        strip: {
          desktop: { path: path("old-d.png"), width: 1940, height: 180, bytes: 1 },
          compact: { path: path("old-c.png"), width: 640, height: 200, bytes: 1 },
        },
      },
    ];
    const { store, calls } = standIn({ stored, files: {} });
    await failureOf(() =>
      saveSponsorsContent(
        store,
        input([base({ strip: { desktop: path("sd.png"), compact: path("sc.jpg") } })]),
      ),
    );
    expect(calls.removed).toEqual([]);
    expect(calls.written).toEqual([]);
  });

  it("still succeeds when a file cannot be removed: the list is right and the file is not referenced", async () => {
    const stored = [
      {
        ...base({ id: "ad-gone" }),
        placements: ["hero"],
        strip: {
          desktop: { path: path("g-d.png", "ad-gone"), width: 1940, height: 180, bytes: 1 },
          compact: { path: path("g-c.png", "ad-gone"), width: 640, height: 200, bytes: 1 },
        },
      },
    ];
    const warn = vi.fn();
    const { store, calls } = standIn({ stored, removeFails: true });
    const done = await saveSponsorsContent(store, input([]), { warn });
    expect(done).toEqual({ count: 0, active: 0 });
    expect(calls.written).toEqual([[]]);
    expect(warn).toHaveBeenCalledWith(expect.any(String), { count: 2 });
  });

  it("leaves a stored value it cannot understand out of the files it keeps, without throwing", async () => {
    const { store, calls } = standIn({
      stored: ["junk", null, { strip: 3 }, { strip: { desktop: 1 } }],
    });
    await saveSponsorsContent(store, input([base()]));
    expect(calls.written).toHaveLength(1);
    expect(calls.removed).toEqual([]);
  });
});
