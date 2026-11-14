import { describe, expect, it, vi } from "vitest";
import { projectData, propertyData } from "../tools/__tests__/fixtures";

const reads = vi.hoisted(() => ({ property: vi.fn(), project: vi.fn() }));

vi.mock("@/features/property", () => ({ getProperty: reads.property }));
vi.mock("@/features/projects", async () => ({
  getProject: reads.project,
  toProjectCard: (await import("../../projects/cards")).toProjectCard,
}));
vi.mock("@/features/saved", async () => ({
  toSavedCard: (await import("../../saved/cards")).toSavedCard,
}));
vi.mock("@/features/home", () => ({
  LISTING_BUCKET: "listing-photos",
  publicStorageUrl: (base: string, bucket: string, path: string) => `${base}/${bucket}/${path}`,
}));
vi.mock("@/features/site", () => ({
  getTranslate: async () => Object.assign((key: string) => key, { has: () => true }),
}));

const { readChatCards } = await import("../chat-cards");
const { readChatCardsInputSchema } = await import("../schemas");

describe("the cards under an answer (AI-P5-T02)", () => {
  it("builds a home card and a project card from the public reads, in the order asked", async () => {
    reads.property.mockResolvedValue({
      status: "found",
      property: propertyData({ shortId: "k3x9a2bd", slug: "two-bhk", title: "Two bedroom flat" }),
      readAt: "2026-11-14T00:00:00.000Z",
    });
    reads.project.mockResolvedValue({
      status: "found",
      project: projectData({ slug: "kadal-vista", name: "Kadal Vista" }),
      readAt: "2026-11-14T00:00:00.000Z",
    });
    const cards = await readChatCards([
      { kind: "project", slug: "kadal-vista" },
      { kind: "home", homeId: "k3x9a2bd", slug: "ignored-by-the-read" },
    ]);
    expect(cards.map((card) => card.kind)).toEqual(["project", "home"]);
    const [project, home] = cards;
    expect(project?.kind === "project" && project.card.href).toBe("/projects/kadal-vista");
    expect(project?.kind === "project" && project.card.name).toBe("Kadal Vista");
    // The link comes from the id and slug the database returned, never from the reference.
    expect(home?.kind === "home" && home.card.href).toBe("/properties/two-bhk-k3x9a2bd");
    expect(home?.kind === "home" && home.shortId).toBe("k3x9a2bd");
  });

  it("leaves out a home or a project that is not there any more", async () => {
    reads.property.mockResolvedValue({ status: "missing", readAt: "2026-11-14T00:00:00.000Z" });
    reads.project.mockResolvedValue({ status: "missing", readAt: "2026-11-14T00:00:00.000Z" });
    expect(
      await readChatCards([
        { kind: "home", homeId: "k3x9a2bd", slug: "gone" },
        { kind: "project", slug: "gone-project" },
      ]),
    ).toEqual([]);
  });
});

describe("the card request (AI-P5-T02)", () => {
  const home = { kind: "home", homeId: "k3x9a2bd", slug: "two-bhk" };
  const project = { kind: "project", slug: "kadal-vista" };

  it("accepts up to three references", () => {
    expect(readChatCardsInputSchema.safeParse({ references: [home, project, home] }).success).toBe(
      true,
    );
    expect(readChatCardsInputSchema.safeParse({ references: [] }).success).toBe(true);
  });

  it("refuses more than three, a bad id, a bad slug and any other kind", () => {
    const refused = (references: unknown) =>
      readChatCardsInputSchema.safeParse({ references }).success === false;
    expect(refused([home, home, home, home])).toBe(true);
    expect(refused([{ ...home, homeId: "not-an-id" }])).toBe(true);
    expect(refused([{ kind: "project", slug: "Has Spaces" }])).toBe(true);
    expect(refused([{ kind: "builder", slug: "kadal-homes" }])).toBe(true);
  });
});
