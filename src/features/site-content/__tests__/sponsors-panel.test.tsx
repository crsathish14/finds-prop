// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import type { HeroFormValues, StandardHero } from "../form";
import type { SponsorStorage } from "../sponsor-storage";
import type { SaveSponsors } from "../sponsors-panel.client";
import type { SponsorEditView, SponsorPictureView } from "../sponsor-view";
import { notAPicture, png } from "./sponsor-fixtures";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { HeroForm } = await import("../hero-form.client");

const words = en.admin.siteContent.sponsors;
const ok: ActionResult<unknown> = { ok: true, data: { count: 1, active: 1 } };

const STANDARD: StandardHero = { title: "Find the place.", subtitle: "Shortlist." };
const HERO: HeroFormValues = {
  eyebrow: "",
  title: STANDARD.title,
  subtitle: "",
  layout: "search_desk",
};

const picture = (path: string, width: number, height: number): SponsorPictureView => ({
  path,
  url: `https://files.test/${path}`,
  width,
  height,
  bytes: 50_000,
  type: "image/webp",
});

function view(id: string, name: string, format: "strip" | "panel" | null = "strip") {
  const sponsor: SponsorEditView = {
    id,
    advertiser: name,
    active: true,
    alt: `${name} banner`,
    href: `https://${id}.example`,
  };
  if (format === "strip") {
    sponsor.strip = {
      desktop: picture(`sponsors/${id}/sd.webp`, 1940, 180),
      compact: picture(`sponsors/${id}/sp.webp`, 640, 200),
    };
  }
  if (format === "panel") {
    sponsor.panel = {
      desktop: picture(`sponsors/${id}/pd.webp`, 1048, 988),
      compact: picture(`sponsors/${id}/pp.webp`, 1280, 640),
    };
  }
  return sponsor;
}

const file = (bytes: Uint8Array, name = "banner.png") =>
  new File([bytes as BlobPart], name, { type: "image/png" });

function setup(
  sponsors: SponsorEditView[] = [],
  saveSponsors: Mock<SaveSponsors> = vi.fn<SaveSponsors>().mockResolvedValue(ok),
) {
  const upload = vi.fn<SponsorStorage["upload"]>().mockResolvedValue(true);
  const remove = vi.fn<SponsorStorage["remove"]>().mockResolvedValue(undefined);
  const storage: SponsorStorage = { upload, remove };
  const saveHero = vi.fn().mockResolvedValue({ ok: true, data: { key: "hero" } });
  renderWithMessages(
    <HeroForm
      initial={HERO}
      standard={STANDARD}
      save={saveHero}
      sponsors={sponsors}
      saveSponsors={saveSponsors}
      storage={storage}
    />,
  );
  return { upload, remove, saveHero, saveSponsors };
}

const drawer = () => screen.getByRole("dialog");
const addButton = () => screen.getAllByRole("button", { name: "Add sponsor" })[0] as HTMLElement;
const typeInto = async (label: RegExp, text: string) =>
  userEvent.type(within(drawer()).getByRole("textbox", { name: label }), text);
const choose = async (title: string, bytes: Uint8Array, name?: string) => {
  const slot = within(drawer()).getByText(title).closest("[data-slot='sponsor-image-slot']");
  const input = slot?.querySelector("input[type='file']") as HTMLInputElement;
  await userEvent.upload(input, file(bytes, name), { applyAccept: false });
};
const fillBoxes = async () => {
  await typeInto(/Advertiser name/, "Sample Developer");
  await typeInto(/Alt text/, "Sample Developer: new launch");
  await typeInto(/Destination link/, "https://sampledeveloper.example");
};
const saveDrawer = async () =>
  userEvent.click(within(drawer()).getByRole("button", { name: "Save sponsor" }));

beforeEach(() => {
  vi.clearAllMocks();
  let count = 0;
  URL.createObjectURL = vi.fn(() => `blob:picture-${++count}`);
  URL.revokeObjectURL = vi.fn();
});

describe("UT-sponsors-panel: the sponsor manager on the Hero page (S7-T11)", () => {
  it("shows the sponsors in their order under the hero boxes, with the new line and the count", () => {
    setup([view("a", "Alpha"), view("b", "Beta", null)]);
    expect(screen.getByText("Shown in this order, one after another.")).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alpha");
    expect(rows[1]).toHaveTextContent("Needs images");
    expect(screen.getByText("2 sponsors · 2 active")).toBeInTheDocument();
  });

  it("says there are no sponsors yet, and draws the hero with no banner", () => {
    setup();
    expect(screen.getByText(words.empty.title)).toBeInTheDocument();
    expect(screen.getAllByText(words.preview.noneTitle).length).toBeGreaterThan(0);
  });

  it("asks for the three boxes before anything is sent, and keeps the drawer open", async () => {
    const { saveSponsors, upload } = setup();
    await userEvent.click(addButton());
    await saveDrawer();
    expect(await within(drawer()).findAllByText(en.validation.required)).toHaveLength(3);
    expect(saveSponsors).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it("adds a sponsor: checks and sends both strip pictures, saves the whole list at once, and says so", async () => {
    const { saveSponsors, upload, remove, saveHero } = setup([view("a", "Alpha")]);
    await userEvent.click(addButton());
    await fillBoxes();
    await choose("Strip · desktop", png(1940, 180, 90_000));
    await choose("Strip · phone", png(640, 200, 40_000));
    expect(await within(drawer()).findAllByText("Fills the slot")).toHaveLength(2);
    await saveDrawer();
    await waitFor(() => expect(saveSponsors).toHaveBeenCalledTimes(1));
    expect(upload).toHaveBeenCalledTimes(2);
    const uploadedPath = upload.mock.calls[0]?.[0] as string;
    const sent = saveSponsors.mock.calls[0]?.[0] as {
      sponsors: { id: string; advertiser: string; strip?: { desktop: string } }[];
    };
    expect(sent.sponsors).toHaveLength(2);
    expect(sent.sponsors[0]?.id).toBe("a");
    const added = sent.sponsors[1];
    expect(added?.advertiser).toBe("Sample Developer");
    expect(uploadedPath).toMatch(new RegExp(`^sponsors/${added?.id}/[0-9a-f]{16}\\.png$`));
    expect(added?.strip?.desktop).toBe(uploadedPath);
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.saved.title, {
        description: words.saved.text,
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    // The hero's own save was not asked for: the two settings save apart.
    expect(saveHero).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("refuses a file that is not a picture, a heavy one and a small one, in the slot, with the reason", async () => {
    setup();
    await userEvent.click(addButton());
    await choose("Strip · desktop", notAPicture(), "banner.svg");
    expect(await within(drawer()).findByText(words.slot.typeTitle)).toBeInTheDocument();
    await choose("Strip · phone", png(300, 150));
    expect(await within(drawer()).findByText(words.slot.smallTitle)).toBeInTheDocument();
    await choose("Panel · desktop", png(1048, 988, 160 * 1024));
    expect(await within(drawer()).findByText(/Rejected: 160 KB is too large/)).toBeInTheDocument();
  });

  it("asks for the other picture when a format has only one", async () => {
    const { saveSponsors } = setup();
    await userEvent.click(addButton());
    await fillBoxes();
    await choose("Strip · desktop", png(1940, 180));
    await saveDrawer();
    expect(await within(drawer()).findByText(words.slot.neededTitle)).toBeInTheDocument();
    expect(saveSponsors).not.toHaveBeenCalled();
  });

  it("puts the server's refusal on the box it names, takes the new files away again and keeps the drawer open", async () => {
    const refusal: ActionResult<unknown> = {
      ok: false,
      code: "VALIDATION",
      fieldErrors: { "sponsors.0.href": [{ key: "validation.linkInvalid" }] },
    };
    const { remove, saveSponsors } = setup([], vi.fn<SaveSponsors>().mockResolvedValue(refusal));
    await userEvent.click(addButton());
    await fillBoxes();
    await choose("Strip · desktop", png(1940, 180));
    await choose("Strip · phone", png(640, 200));
    await saveDrawer();
    await waitFor(() => expect(saveSponsors).toHaveBeenCalled());
    expect(await within(drawer()).findByText(en.validation.linkInvalid)).toBeInTheDocument();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls[0]?.[0]).toHaveLength(2);
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("says so on the picture when the bucket will not take it, and sends no list", async () => {
    const { upload, saveSponsors } = setup();
    upload.mockResolvedValue(false);
    await userEvent.click(addButton());
    await fillBoxes();
    await choose("Strip · desktop", png(1940, 180));
    await choose("Strip · phone", png(640, 200));
    await saveDrawer();
    expect(await within(drawer()).findByText(words.slot.uploadTitle)).toBeInTheDocument();
    expect(saveSponsors).not.toHaveBeenCalled();
  });

  it("edits a sponsor in its place, with its stored pictures sent back as they were", async () => {
    const { saveSponsors, upload } = setup([view("a", "Alpha"), view("b", "Beta")]);
    await userEvent.click(screen.getByRole("button", { name: "Edit Alpha" }));
    expect(within(drawer()).getByText("Edit sponsor")).toBeInTheDocument();
    const name = within(drawer()).getByRole("textbox", { name: /Advertiser name/ });
    expect(name).toHaveValue("Alpha");
    await userEvent.clear(name);
    await userEvent.type(name, "Alpha Homes");
    await userEvent.click(within(drawer()).getByRole("switch", { name: /Active/ }));
    await saveDrawer();
    await waitFor(() => expect(saveSponsors).toHaveBeenCalledTimes(1));
    const sent = saveSponsors.mock.calls[0]?.[0] as {
      sponsors: { id: string; advertiser: string; active: boolean; strip: { compact: string } }[];
    };
    expect(sent.sponsors.map((one) => one.id)).toEqual(["a", "b"]);
    expect(sent.sponsors[0]).toMatchObject({
      advertiser: "Alpha Homes",
      active: false,
      strip: { compact: "sponsors/a/sp.webp" },
    });
    expect(upload).not.toHaveBeenCalled();
  });

  it("leaves nothing in the bucket when the drawer is cancelled", async () => {
    const { upload, saveSponsors } = setup();
    await userEvent.click(addButton());
    await choose("Strip · desktop", png(1940, 180));
    await userEvent.click(within(drawer()).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(upload).not.toHaveBeenCalled();
    expect(saveSponsors).not.toHaveBeenCalled();
  });

  it("does not let the drawer's save reach the Hero page's own form", async () => {
    const { saveHero } = setup();
    await userEvent.click(addButton());
    await saveDrawer();
    expect(saveHero).not.toHaveBeenCalled();
  });

  it("moves a sponsor with the arrows and saves the new order at once", async () => {
    const { saveSponsors } = setup([view("a", "Alpha"), view("b", "Beta")]);
    await userEvent.click(screen.getByRole("button", { name: "Move Beta up" }));
    await waitFor(() => expect(saveSponsors).toHaveBeenCalledTimes(1));
    const sent = saveSponsors.mock.calls[0]?.[0] as { sponsors: { id: string }[] };
    expect(sent.sponsors.map((one) => one.id)).toEqual(["b", "a"]);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(router.refresh).toHaveBeenCalled();
  });

  it("asks before deleting, and deleting saves the shorter list at once", async () => {
    const { saveSponsors } = setup([view("a", "Alpha"), view("b", "Beta")]);
    await userEvent.click(screen.getByRole("button", { name: "Delete Alpha" }));
    const question = await screen.findByRole("alertdialog");
    expect(within(question).getByText("Delete Alpha?")).toBeInTheDocument();
    expect(saveSponsors).not.toHaveBeenCalled();
    await userEvent.click(within(question).getByRole("button", { name: "Cancel" }));
    expect(saveSponsors).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Delete Alpha" }));
    const again = await screen.findByRole("alertdialog");
    await userEvent.click(within(again).getByRole("button", { name: "Delete sponsor" }));
    await waitFor(() => expect(saveSponsors).toHaveBeenCalledTimes(1));
    const sent = saveSponsors.mock.calls[0]?.[0] as { sponsors: { id: string }[] };
    expect(sent.sponsors.map((one) => one.id)).toEqual(["b"]);
  });

  it("says a failed move in a toast and reads the page again", async () => {
    const { saveSponsors } = setup(
      [view("a", "Alpha"), view("b", "Beta")],
      vi.fn<SaveSponsors>().mockResolvedValue({ ok: false, code: "RATE_LIMITED", retryAfter: 600 }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Move Beta up" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(saveSponsors).toHaveBeenCalledTimes(1);
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("stops adding at ten sponsors and says why", () => {
    const ten = Array.from({ length: 10 }, (_, index) => view(`s${index}`, `Sponsor ${index}`));
    setup(ten);
    expect(addButton()).toBeDisabled();
    expect(screen.getByText(/You can keep up to 10 sponsors/)).toBeInTheDocument();
  });

  it("draws the first sponsor's banner in the preview and warns when the layout needs another format", async () => {
    setup([view("a", "Alpha"), view("b", "Beta", "panel")]);
    expect(screen.getByText("Alpha · first of 1 active")).toBeInTheDocument();
    expect(screen.getByText(/Live layout: Search Desk/)).toBeInTheDocument();
    expect(
      screen.getByText("1 of 2 sponsors doesn't have the Search Desk format"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Split/ }));
    expect(screen.getByText("Beta · first of 1 active")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 sponsors doesn't have the Split format")).toBeInTheDocument();
  });

  it("says no sponsor can be shown when none has the layout's format", async () => {
    setup([view("a", "Alpha")]);
    await userEvent.click(screen.getByRole("radio", { name: /Split/ }));
    expect(screen.getByText("No sponsor can be shown in Split")).toBeInTheDocument();
    expect(screen.getAllByText(words.preview.noneTitle).length).toBeGreaterThan(0);
  });

  it("keeps the hero words being typed when the sponsors change", async () => {
    setup([view("a", "Alpha"), view("b", "Beta")]);
    await userEvent.type(screen.getByRole("textbox", { name: /Eyebrow/ }), "Tamil Nadu");
    await userEvent.click(screen.getByRole("button", { name: "Move Beta up" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(screen.getByRole("textbox", { name: /Eyebrow/ })).toHaveValue("Tamil Nadu");
  });
});
