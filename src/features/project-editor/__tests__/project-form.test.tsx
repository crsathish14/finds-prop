// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { pictureFile } from "../../../../tests/image-files";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import type { MediaStorage } from "../media-storage";
import type { ProjectDone } from "../project-service";
import type { ProjectEditView } from "../view";
import { changeField, optionTexts } from "../../../../tests/select";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));
// A stand-in for the browser's own decoding and encoding: a picture "weighs" 100,000 bytes times the quality it is saved at.
vi.mock("@/lib/image-browser", () => ({
  browserImageDeps: {
    decode: async () => ({ width: 100, height: 100, close: () => undefined }),
    encode: async (_picture: unknown, _size: unknown, type: string, quality: number) =>
      new Blob([new Uint8Array(Math.round(quality * 100_000))], { type }),
  },
}));

const { ProjectForm } = await import("../project-form.client");

const words = en.admin.projectForm;
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const BUILDER_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_BUILDER_ID = "44444444-4444-4444-8444-444444444444";
const BASE = "https://storage.example.test";

const BUILDERS = [
  { id: BUILDER_ID, name: "Kadal Homes", active: true },
  { id: OTHER_BUILDER_ID, name: "Nila Habitats", active: true },
];
const FORMS = [{ id: "33333333-3333-4333-8333-333333333333", name: "Site-visit form" }];

const saved: ProjectEditView = {
  id: PROJECT_ID,
  name: "Kadal Vista",
  slug: "kadal-vista",
  builderId: BUILDER_ID,
  projectType: "residential",
  propertyType: "apartment",
  offerType: null,
  plotStatus: null,
  villaType: null,
  extraFields: {},
  projectStatus: "under_construction",
  price: 7800000,
  priceType: "basic",
  areaMinSqft: null,
  areaMaxSqft: null,
  bhkOptions: [2, 3],
  landAreaAcres: 4.2,
  possessionDate: "2028-12-01",
  contactPhone: null,
  city: "Chennai",
  locality: "OMR Navalur",
  address: null,
  latitude: null,
  longitude: null,
  advantages: [],
  nearby: [],
  reraApplicable: false,
  reraNumber: null,
  reraNotApplicableReason: "Below the size that needs registration.",
  description: "A gated community.",
  specifications: null,
  amenities: [],
  seoTitle: null,
  seoDescription: null,
  images: [`${PROJECT_ID}/3f2a9c1b-front-view.jpg`],
  floorPlans: [],
  elevations: [],
  plotImages: [],
  videos: [],
  brochure: null,
  formId: null,
  moderation: "approved",
  published: true,
  featured: false,
  rejectionReason: null,
  trends: [{ month: "2026-10", pricePerSqft: 8350 }],
};

const done = (over: Partial<ProjectDone> = {}): ActionResult<ProjectDone> => ({
  ok: true,
  data: {
    projectId: PROJECT_ID,
    slug: "kadal-vista",
    previousSlug: null,
    moderation: "approved",
    previousModeration: "approved",
    ...over,
  },
});

function fakeStorage(uploads: boolean | (() => Promise<boolean>) = true): MediaStorage {
  return {
    upload: vi.fn(typeof uploads === "function" ? uploads : async () => uploads),
    remove: vi.fn(async () => undefined),
  };
}

type Setup = {
  scope?: "admin" | "builder";
  project?: ProjectEditView | null;
  save?: Mock;
  storage?: MediaStorage;
};

function open({ scope = "admin", project = null, save, storage }: Setup = {}) {
  const action = save ?? vi.fn(async () => done());
  const media = storage ?? fakeStorage();
  renderWithMessages(
    <ProjectForm
      scope={scope}
      project={project}
      {...(scope === "admin" ? { builders: BUILDERS, forms: FORMS } : {})}
      save={action as never}
      backHref="/admin/projects"
      editBase="/admin/projects"
      storage={media}
      mediaBaseUrl={BASE}
    />,
  );
  return { save: action, storage: media };
}

/** A label as the start of an accessible name; the label may hold brackets, so it is escaped. */
const startsWith = (label: string) =>
  new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
const box = (name: string) => screen.getByRole("textbox", { name: startsWith(name) });
const saveButton = () => screen.getByRole("button", { name: words.save.save });
const select = (label: string) => screen.getByRole("combobox", { name: startsWith(label) });

/** Fills every required box of a new project: a residential apartment, ready to move, not under RERA. */
async function fillRequired({ admin }: { admin: boolean }) {
  await userEvent.type(box(words.fields.name), "Kadal Vista");
  if (admin) await changeField(select(words.fields.builder), BUILDER_ID);
  await changeField(select(words.fields.projectType), "residential");
  await changeField(select(words.fields.propertyType), "apartment");
  await changeField(select(words.fields.projectStatus), "ready_to_move");
  await userEvent.type(box(words.fields.price), "78,00,000");
  await changeField(select(words.fields.priceType), "basic");
  await userEvent.type(box(words.fields.reraReason), "Below the size that needs registration.");
  await userEvent.type(box(words.fields.city), "Chennai");
  await userEvent.type(box(words.fields.locality), "OMR Navalur");
}
const fileInput = (group: string) =>
  screen.getByRole("group", { name: group }).querySelector("input[type=file]") as HTMLInputElement;
const png = (name = "plan.png", dataBytes = 8) => pictureFile("image/png", dataBytes, name);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProjectForm: a new project (S7-T02, part C)", () => {
  it("shows the new project's heading, the admin's boxes and a locked media section", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: words.newTitle })).toBeVisible();
    expect(
      screen.getByRole("combobox", { name: new RegExp(`^${words.fields.builder}`) }),
    ).toBeVisible();
    expect(screen.getByRole("combobox", { name: words.enquiry.title })).toBeVisible();
    expect(screen.getByText(words.media.locked)).toBeVisible();
    for (const input of document.querySelectorAll("input[type=file]")) {
      expect((input as HTMLInputElement).disabled).toBe(true);
    }
    // Price trends come after the first save.
    expect(screen.queryByRole("group", { name: words.trends.title })).toBeNull();
    // No warning for the admin.
    expect(screen.queryByText(words.warning.title)).toBeNull();
    expect(screen.getByText(words.save.noteAdmin)).toBeVisible();
  });

  it("suggests the page address from the name until the person types one", async () => {
    open();
    await userEvent.type(box(words.fields.name), "Kadal Vista Phase 2");
    expect((box(words.fields.slug) as HTMLInputElement).value).toBe("kadal-vista-phase-2");
    await userEvent.clear(box(words.fields.slug));
    await userEvent.type(box(words.fields.slug), "my-own-address");
    await userEvent.type(box(words.fields.name), " Extra");
    expect((box(words.fields.slug) as HTMLInputElement).value).toBe("my-own-address");
  });

  it("does not save and names everything that is missing at once", async () => {
    const { save } = open();
    await userEvent.click(saveButton());
    expect(save).not.toHaveBeenCalled();
    expect(await screen.findByText("10 things need attention")).toBeVisible();
    for (const problem of [
      "name",
      "builder",
      "projectType",
      "propertyType",
      "status",
      "price",
      "priceType",
      "reraReason",
      "city",
      "locality",
    ] as const) {
      expect(screen.getByText(words.problems[problem])).toBeVisible();
    }
    // The line under the title names the boxes.
    const named = [
      words.fields.name,
      words.fields.builder,
      words.fields.projectType,
      words.fields.propertyType,
      words.fields.projectStatus,
      words.fields.price,
      words.fields.priceType,
      words.fields.reraReason,
      words.fields.city,
      words.fields.locality,
    ].join(", ");
    expect(screen.getByText(`Check ${named} before saving.`)).toBeVisible();
    const nav = screen.getByRole("navigation", { name: words.nav.label });
    // Basics, Location and RERA each have a problem; the list says so in words.
    expect(within(nav).getAllByText(words.nav.error, { exact: false })).toHaveLength(3);
  });

  it("asks only for what applies: a plot asks for an area range and no bedrooms, a ready project for no possession", async () => {
    open();
    await changeField(select(words.fields.projectType), "residential");
    await changeField(select(words.fields.propertyType), "apartment");
    expect(screen.getByRole("group", { name: new RegExp(words.fields.bhk) })).toBeVisible();
    expect(screen.queryByRole("textbox", { name: startsWith(words.fields.areaMin) })).toBeNull();
    await changeField(select(words.fields.projectStatus), "new_launch");
    expect(screen.getByLabelText(words.fields.possession, { exact: false })).toBeVisible();
    await changeField(select(words.fields.projectStatus), "ready_to_move");
    expect(screen.queryByLabelText(words.fields.possession, { exact: false })).toBeNull();
    await changeField(select(words.fields.propertyType), "plot");
    expect(screen.queryByRole("group", { name: new RegExp(words.fields.bhk) })).toBeNull();
    expect(box(words.fields.areaMin)).toBeVisible();
    expect(box(words.fields.areaMax)).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: new RegExp(`^${words.fields.offerType}`) }),
    ).toBeNull();
  });

  it("offers the property types of the project type, and the rent price types only for a commercial project for rent", async () => {
    open();
    await changeField(select(words.fields.projectType), "residential");
    expect(await optionTexts(select(words.fields.propertyType))).toEqual([
      words.fields.unset,
      words.options.propertyType.apartment,
      words.options.propertyType.villa,
      words.options.propertyType.plot,
    ]);
    expect(await optionTexts(select(words.fields.priceType))).toEqual([
      words.fields.unset,
      words.options.priceType.perSqft,
      words.options.priceType.basic,
      words.options.priceType.allInclusive,
    ]);
    await changeField(select(words.fields.projectType), "commercial");
    expect(await optionTexts(select(words.fields.propertyType))).toEqual([
      words.fields.unset,
      words.options.propertyType.vacantLand,
      words.options.propertyType.flat,
      words.options.propertyType.office,
      words.options.propertyType.coWorking,
      words.options.propertyType.villa,
    ]);
    await changeField(select(words.fields.offerType), "rent");
    expect(await optionTexts(select(words.fields.priceType))).toEqual([
      words.fields.unset,
      words.options.priceType.rentPerMonth,
      words.options.priceType.rentPerSqftMonth,
    ]);
  });

  it("clears the price type and the property type when what they depend on changes", async () => {
    open();
    await changeField(select(words.fields.projectType), "commercial");
    await changeField(select(words.fields.propertyType), "office");
    await changeField(select(words.fields.offerType), "rent");
    await changeField(select(words.fields.priceType), "rent_per_month");
    await changeField(select(words.fields.offerType), "sale");
    expect(select(words.fields.priceType)).toHaveTextContent(words.fields.unset);
    await changeField(select(words.fields.projectType), "residential");
    expect(select(words.fields.propertyType)).toHaveTextContent(words.fields.unset);
  });

  it("says the RERA reason is shown publicly, and asks for the number instead when RERA applies", async () => {
    open();
    expect(screen.getByText(words.fields.reraReasonHint)).toBeVisible();
    await userEvent.click(screen.getByRole("switch", { name: words.fields.reraApplicable }));
    expect(screen.queryByText(words.fields.reraReasonHint)).toBeNull();
    expect(box(words.fields.reraNumber)).toBeVisible();
    await userEvent.click(saveButton());
    expect(await screen.findByText(words.problems.reraNumber)).toBeVisible();
  });

  it("holds the save back when the largest area is below the smallest", async () => {
    const { save } = open();
    await fillRequired({ admin: true });
    await changeField(select(words.fields.propertyType), "plot");
    await changeField(select(words.fields.priceType), "per_sqft");
    await userEvent.type(box(words.fields.areaMin), "2400");
    await userEvent.type(box(words.fields.areaMax), "1200");
    await userEvent.click(saveButton());
    expect(save).not.toHaveBeenCalled();
    expect(await screen.findByText(words.problems.areaRange)).toBeVisible();
  });

  it("clears a box's message as soon as it is typed in", async () => {
    open();
    await userEvent.click(saveButton());
    expect(await screen.findByText(words.problems.name)).toBeVisible();
    await userEvent.type(box(words.fields.name), "K");
    expect(screen.queryByText(words.problems.name)).toBeNull();
  });

  it("creates the project with its boxes only, then opens its edit page", async () => {
    const { save } = open();
    await fillRequired({ admin: true });
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent).toMatchObject({
      name: "Kadal Vista",
      slug: "kadal-vista",
      locality: "OMR Navalur",
      builderId: BUILDER_ID,
      formId: "",
      projectType: "residential",
      propertyType: "apartment",
      projectStatus: "ready_to_move",
      price: "78,00,000",
      priceType: "basic",
      reraApplicable: false,
      reraNotApplicableReason: "Below the size that needs registration.",
    });
    expect("projectId" in sent).toBe(false);
    expect("images" in sent).toBe(false);
    expect("priceTrends" in sent).toBe(false);
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith(`/admin/projects/${PROJECT_ID}`),
    );
    expect(toast.success).toHaveBeenCalledWith(words.toast.created.title, {
      description:
        "Kadal Vista is waiting for approval. You can now add its media and price trends.",
    });
  });

  it("puts the server's message on the page address when it is taken", async () => {
    const save = vi.fn(async () => ({
      ok: false as const,
      code: "VALIDATION" as const,
      fieldErrors: { slug: [{ key: "validation.slugTaken" }] },
    }));
    open({ save });
    await fillRequired({ admin: true });
    await userEvent.click(saveButton());
    expect(await screen.findByText(en.validation.slugTaken)).toBeVisible();
    expect(screen.getByText("1 thing needs attention")).toBeVisible();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("says a failure with no box in a toast and reads the page again", async () => {
    const save = vi.fn(async () => ({
      ok: false as const,
      code: "RATE_LIMITED" as const,
      retryAfter: 120,
    }));
    open({ save });
    await fillRequired({ admin: true });
    await userEvent.click(saveButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(router.refresh).toHaveBeenCalled();
  });

  it("goes back when Cancel is chosen", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: words.save.cancel }));
    expect(router.push).toHaveBeenCalledWith("/admin/projects");
  });
});

describe("ProjectForm: a saved project, for the admin (S7-T02, part C)", () => {
  it("opens filled, with its builder as the only choice, the enquiry form box and the price trends", async () => {
    open({ project: saved });
    expect(screen.getByRole("heading", { level: 1, name: "Kadal Vista" })).toBeVisible();
    expect((box(words.fields.name) as HTMLInputElement).value).toBe("Kadal Vista");
    const builder = screen.getByRole("combobox", { name: new RegExp(`^${words.fields.builder}`) });
    expect(await optionTexts(builder)).toEqual([words.fields.unset, "Kadal Homes"]);
    const trends = screen.getByRole("group", { name: words.trends.title });
    expect((within(trends).getByLabelText("Month 1") as HTMLInputElement).value).toBe("2026-10");
    expect(screen.queryByText(words.media.locked)).toBeNull();
    expect(screen.getByText("front-view.jpg")).toBeVisible();
  });

  it("does not suggest a new page address when the name changes", async () => {
    open({ project: saved });
    await userEvent.type(box(words.fields.name), " Two");
    expect((box(words.fields.slug) as HTMLInputElement).value).toBe("kadal-vista");
  });

  it("saves with the project's id, its media paths and its price trends, and reads the page again", async () => {
    const { save } = open({ project: saved });
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent).toMatchObject({
      projectId: PROJECT_ID,
      images: [`${PROJECT_ID}/3f2a9c1b-front-view.jpg`],
      brochure: null,
      videos: [],
      priceTrends: [{ month: "2026-10", pricePerSqft: "8350" }],
    });
    expect("builderId" in sent).toBe(false);
    await waitFor(() => expect(router.refresh).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith(words.toast.saved.title, {
      description: words.toast.saved.text,
    });
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("uploads a chosen file into the project's folder and sends its path on the next save", async () => {
    const { save, storage } = open({ project: saved });
    fireEvent.change(fileInput("Floor plans"), { target: { files: [png("Two BHK plan.png")] } });
    await waitFor(() => expect(storage.upload).toHaveBeenCalledTimes(1));
    const [path] = (storage.upload as Mock).mock.calls[0] as [string, File];
    expect(path).toMatch(new RegExp(`^${PROJECT_ID}/[0-9a-f]{8}-Two-BHK-plan\\.png$`));
    // The tile shows the file's own name, finished.
    expect(await screen.findByText("Two-BHK-plan.png")).toBeVisible();
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect((save.mock.calls[0]?.[0] as Record<string, unknown>).floorPlans).toEqual([path]);
  });

  it("refuses a file that is not a picture of a kind the site takes before sending it, and does not save it", async () => {
    const { save, storage } = open({ project: saved });
    const pdf = new File(["x"], "plan.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput("Elevations"), { target: { files: [pdf] } });
    // A file that says it is a PNG but is not one is refused too: only its own bytes count.
    fireEvent.change(fileInput("Plot images"), {
      target: { files: [new File(["<svg/>"], "plan.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(screen.getAllByText(words.media.errors.type)).toHaveLength(2));
    expect(storage.upload).not.toHaveBeenCalled();
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalled());
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent.elevations).toEqual([]);
    expect(sent.plotImages).toEqual([]);
  });

  it("refuses a brochure over 10 MB, as before", async () => {
    const { storage } = open({ project: saved });
    const brochure = new File(["x"], "brochure.pdf", { type: "application/pdf" });
    Object.defineProperty(brochure, "size", { value: 11 * 1024 * 1024 });
    fireEvent.change(fileInput("Brochure (PDF)"), { target: { files: [brochure] } });
    expect(await screen.findByText("Too large. The most is 10 MB.")).toBeVisible();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("takes the hidden data out of a picture before it is sent", async () => {
    const { storage } = open({ project: saved });
    const clean = pictureFile("image/jpeg", 50, "front.jpg");
    const bytes = new Uint8Array(await clean.arrayBuffer());
    const secret = new TextEncoder().encode("GPS-SECRET");
    const comment = new Uint8Array([0xff, 0xfe, 0x00, secret.length + 2, ...secret]);
    const marked = new File([bytes.slice(0, 2), comment, bytes.slice(2)], "front.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(fileInput("Elevations"), { target: { files: [marked] } });
    await waitFor(() => expect(storage.upload).toHaveBeenCalledTimes(1));
    const [, sent] = (storage.upload as Mock).mock.calls[0] as [string, File];
    expect(sent.size).toBe(clean.size);
    expect(new TextDecoder().decode(await sent.arrayBuffer())).not.toContain("GPS-SECRET");
  });

  it("offers to lower the quality of a picture over 10 MB, and sends nothing yet", async () => {
    const { storage } = open({ project: saved });
    fireEvent.change(fileInput("Plot images"), {
      target: { files: [png("huge.png", 11 * 1024 * 1024)] },
    });
    expect(await screen.findByText(en.imageReduce.offer.title)).toBeVisible();
    expect(screen.getByText(/the limit is 10 MB/)).toBeVisible();
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("lowers the quality when asked, and sends the lowered picture once it is used", async () => {
    const { save, storage } = open({ project: saved });
    fireEvent.change(fileInput("Plot images"), {
      target: { files: [png("huge.png", 11 * 1024 * 1024)] },
    });
    await userEvent.click(await screen.findByRole("button", { name: en.imageReduce.reduce }));
    expect(await screen.findByText(en.imageReduce.ready.title)).toBeVisible();
    expect(storage.upload).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: en.imageReduce.use }));
    await waitFor(() => expect(storage.upload).toHaveBeenCalledTimes(1));
    const [path, sent] = (storage.upload as Mock).mock.calls[0] as [string, File];
    expect(path).toMatch(new RegExp(`^${PROJECT_ID}/[0-9a-f]{8}-huge\.webp$`));
    expect(sent.type).toBe("image/webp");
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect((save.mock.calls[0]?.[0] as Record<string, unknown>).plotImages).toEqual([path]);
  });

  it("leaves a heavy picture out when the admin chooses another, and goes on with the rest", async () => {
    const { storage } = open({ project: saved });
    fireEvent.change(fileInput("Plot images"), {
      target: { files: [png("huge.png", 11 * 1024 * 1024), png("small.png")] },
    });
    await userEvent.click(
      await screen.findByRole("button", { name: en.imageReduce.chooseAnother }),
    );
    await waitFor(() => expect(storage.upload).toHaveBeenCalledTimes(1));
    const [path] = (storage.upload as Mock).mock.calls[0] as [string, File];
    expect(path).toMatch(/small\.png$/);
    expect(screen.queryByText(en.imageReduce.offer.title)).toBeNull();
  });

  it("shows an upload that failed on its tile and does not send it", async () => {
    const { save } = open({ project: saved, storage: fakeStorage(false) });
    fireEvent.change(fileInput("Floor plans"), { target: { files: [png()] } });
    expect(await screen.findByText(words.media.errors.upload)).toBeVisible();
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect((save.mock.calls[0]?.[0] as Record<string, unknown>).floorPlans).toEqual([]);
  });

  it("does not save while a file is still on its way", async () => {
    const { save } = open({
      project: saved,
      storage: fakeStorage(() => new Promise(() => undefined)),
    });
    fireEvent.change(fileInput("Floor plans"), { target: { files: [png()] } });
    expect(await screen.findByText(words.media.files.uploading)).toBeVisible();
    await userEvent.click(saveButton());
    expect(save).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(words.media.wait);
  });

  it("takes a file added in this visit out of the bucket at once, and a saved one only after the save", async () => {
    const { storage } = open({ project: saved });
    fireEvent.change(fileInput("Floor plans"), { target: { files: [png("plan.png")] } });
    await screen.findByText("plan.png");
    const [path] = (storage.upload as Mock).mock.calls[0] as [string, File];
    await userEvent.click(screen.getByRole("button", { name: "Remove: plan.png" }));
    expect(storage.remove).toHaveBeenCalledWith([path]);

    (storage.remove as Mock).mockClear();
    await userEvent.click(screen.getByRole("button", { name: "Remove: front-view.jpg" }));
    expect(storage.remove).not.toHaveBeenCalled();
    await userEvent.click(saveButton());
    await waitFor(() =>
      expect(storage.remove).toHaveBeenCalledWith([`${PROJECT_ID}/3f2a9c1b-front-view.jpg`]),
    );
  });

  it("keeps a removed saved file in the bucket when the save fails", async () => {
    const save = vi.fn(async () => ({ ok: false as const, code: "INTERNAL" as const }));
    const { storage } = open({ project: saved, save });
    await userEvent.click(screen.getByRole("button", { name: "Remove: front-view.jpg" }));
    await userEvent.click(saveButton());
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("holds the save back and marks the rows when a price trend is wrong", async () => {
    const { save } = open({ project: saved });
    const trends = screen.getByRole("group", { name: words.trends.title });
    await userEvent.click(within(trends).getByRole("button", { name: words.trends.add }));
    fireEvent.change(within(trends).getByLabelText("₹ per sq.ft 2"), {
      target: { value: "eight" },
    });
    await changeField(within(trends).getByLabelText("Month 2"), "2026-10");
    await userEvent.click(saveButton());
    expect(save).not.toHaveBeenCalled();
    expect(await within(trends).findByText(words.trends.errors.monthTwice)).toBeVisible();
    expect(within(trends).getByText(words.trends.errors.priceNumber)).toBeVisible();
    expect(screen.getByText(words.trends.fix, { exact: false })).toBeTruthy();
  });

  it("adds a video link and sends it", async () => {
    const { save } = open({ project: saved });
    await userEvent.type(
      screen.getByRole("textbox", { name: words.media.videos.label }),
      "https://www.example.com/watch/tour{Enter}",
    );
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect((save.mock.calls[0]?.[0] as Record<string, unknown>).videos).toEqual([
      "https://www.example.com/watch/tour",
    ]);
  });
});

describe("ProjectForm: a builder's form (S7-T02, part C)", () => {
  it("shows the approval warning, no Builder, Enquiry form or Price trends box, and the builder's save note", () => {
    open({ scope: "builder", project: saved });
    expect(screen.getByText(words.warning.title)).toBeVisible();
    expect(screen.getByText(words.warning.text)).toBeVisible();
    expect(
      screen.queryByRole("combobox", { name: new RegExp(`^${words.fields.builder}`) }),
    ).toBeNull();
    expect(screen.queryByRole("combobox", { name: words.enquiry.title })).toBeNull();
    expect(screen.queryByRole("group", { name: words.trends.title })).toBeNull();
    expect(screen.getByText(words.save.noteBuilder)).toBeVisible();
  });

  it("locks the page address of an approved project", () => {
    open({ scope: "builder", project: saved });
    expect((box(words.fields.slug) as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByText(words.fields.slugLockedHint)).toBeVisible();
  });

  it("leaves the page address open for a project that is not approved yet", () => {
    open({ scope: "builder", project: { ...saved, moderation: "pending" } });
    expect((box(words.fields.slug) as HTMLInputElement).readOnly).toBe(false);
  });

  it("creates a builder's own project without a builder box, and says it waits for approval without mentioning price trends", async () => {
    const { save } = open({ scope: "builder" });
    await fillRequired({ admin: false });
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>;
    expect("builderId" in sent).toBe(false);
    expect("formId" in sent).toBe(false);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.toast.created.title, {
        description:
          "Kadal Vista is waiting for approval. You can now add its images, floor plans and brochure.",
      }),
    );
  });

  it("sends a builder's save without the enquiry form or the price trends, and says it is back in review", async () => {
    const { save } = open({
      scope: "builder",
      project: saved,
      save: vi.fn(async () => done({ moderation: "pending", previousModeration: "approved" })),
    });
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalled());
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>;
    expect("formId" in sent).toBe(false);
    expect("priceTrends" in sent).toBe(false);
    expect(sent.projectId).toBe(PROJECT_ID);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.toast.savedBuilder.title, {
        description: words.toast.savedBuilder.text,
      }),
    );
  });
});
