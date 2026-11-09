// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import type { MediaStorage } from "../media-storage";
import type { ProjectDone } from "../project-service";
import type { ProjectEditView } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

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
  projectStatus: "under_construction",
  priceMin: 7800000,
  priceMax: 14200000,
  bhkOptions: [2, 3],
  landAreaAcres: 4.2,
  totalUnits: 320,
  possessionDate: "2028-12-31",
  contactPhone: null,
  locality: "OMR Navalur",
  address: null,
  latitude: null,
  longitude: null,
  advantages: [],
  nearby: [],
  reraApplicable: false,
  reraNumber: null,
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

const box = (name: string) => screen.getByRole("textbox", { name: new RegExp(`^${name}`) });
const saveButton = () => screen.getByRole("button", { name: words.save.save });
const fileInput = (group: string) =>
  screen.getByRole("group", { name: group }).querySelector("input[type=file]") as HTMLInputElement;
const png = (name = "plan.png", size = 1000) => {
  const file = new File(["x"], name, { type: "image/png" });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

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

  it("does not save and names what is missing when the name, builder and locality are empty", async () => {
    const { save } = open();
    await userEvent.click(saveButton());
    expect(save).not.toHaveBeenCalled();
    expect(await screen.findByText("3 things need attention")).toBeVisible();
    expect(screen.getByText(words.problems.name)).toBeVisible();
    expect(screen.getByText(words.problems.builder)).toBeVisible();
    expect(screen.getByText(words.problems.locality)).toBeVisible();
    // The line under the title names the boxes.
    expect(
      screen.getByText(
        `Check ${words.fields.name}, ${words.fields.builder}, ${words.fields.locality} before saving.`,
      ),
    ).toBeVisible();
    const nav = screen.getByRole("navigation", { name: words.nav.label });
    // Basics and Location each have a problem; the list says so in words.
    expect(within(nav).getAllByText(words.nav.error, { exact: false })).toHaveLength(2);
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
    await userEvent.type(box(words.fields.name), "Kadal Vista");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: new RegExp(`^${words.fields.builder}`) }),
      BUILDER_ID,
    );
    await userEvent.type(box(words.fields.locality), "OMR Navalur");
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent).toMatchObject({
      name: "Kadal Vista",
      slug: "kadal-vista",
      locality: "OMR Navalur",
      builderId: BUILDER_ID,
      formId: "",
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
    await userEvent.type(box(words.fields.name), "Kadal Vista");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: new RegExp(`^${words.fields.builder}`) }),
      BUILDER_ID,
    );
    await userEvent.type(box(words.fields.locality), "OMR Navalur");
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
    await userEvent.type(box(words.fields.name), "Kadal Vista");
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: new RegExp(`^${words.fields.builder}`) }),
      BUILDER_ID,
    );
    await userEvent.type(box(words.fields.locality), "OMR Navalur");
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
  it("opens filled, with its builder as the only choice, the enquiry form box and the price trends", () => {
    open({ project: saved });
    expect(screen.getByRole("heading", { level: 1, name: "Kadal Vista" })).toBeVisible();
    expect((box(words.fields.name) as HTMLInputElement).value).toBe("Kadal Vista");
    const builder = screen.getByRole("combobox", { name: new RegExp(`^${words.fields.builder}`) });
    expect(
      within(builder)
        .getAllByRole("option")
        .map((option) => option.textContent),
    ).toEqual([words.fields.unset, "Kadal Homes"]);
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

  it("refuses a file of the wrong type or over 10 MB before sending it, and does not save it", async () => {
    const { save, storage } = open({ project: saved });
    const pdf = new File(["x"], "plan.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput("Elevations"), { target: { files: [pdf] } });
    fireEvent.change(fileInput("Plot images"), {
      target: { files: [png("huge.png", 11 * 1024 * 1024)] },
    });
    expect(await screen.findByText(words.media.errors.type)).toBeVisible();
    expect(screen.getByText("Too large. The most is 10 MB.")).toBeVisible();
    expect(storage.upload).not.toHaveBeenCalled();
    await userEvent.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalled());
    const sent = save.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(sent.elevations).toEqual([]);
    expect(sent.plotImages).toEqual([]);
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
    fireEvent.change(within(trends).getByLabelText("Month 2"), { target: { value: "2026-10" } });
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
