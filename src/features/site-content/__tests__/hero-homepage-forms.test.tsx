// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import type { HeroFormValues, HomepageFormValues, StandardHero } from "../form";
import type { SponsorEditView } from "../sponsor-view";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { HeroForm } = await import("../hero-form.client");
const { HomepageForm } = await import("../homepage-form.client");

const words = en.admin.siteContent;
const ok: ActionResult<unknown> = { ok: true, data: { key: "hero" } };
const picture = (name: string) => document.querySelector(`[data-slot='${name}']`);

const STANDARD: StandardHero = {
  title: "Find the place that fits your life.",
  subtitle: "Shortlist, compare and enquire directly.",
};
const HERO: HeroFormValues = {
  eyebrow: "",
  title: STANDARD.title,
  subtitle: "",
  layout: "search_desk",
};

beforeEach(() => vi.clearAllMocks());

/** A sponsor with a panel, so Split has a banner to draw. */
const PANEL_SPONSOR: SponsorEditView = {
  id: "a",
  advertiser: "Alpha",
  active: true,
  alt: "Alpha banner",
  href: "https://alpha.example",
  panel: {
    desktop: {
      path: "sponsors/a/pd.webp",
      url: "https://files.test/pd.webp",
      width: 1048,
      height: 988,
      bytes: null,
      type: "image/webp",
    },
    compact: {
      path: "sponsors/a/pp.webp",
      url: "https://files.test/pp.webp",
      width: 1280,
      height: 640,
      bytes: null,
      type: "image/webp",
    },
  },
};

describe("UT-hero-page: the Hero page (S7-T10)", () => {
  const open = (
    save = vi.fn().mockResolvedValue(ok),
    initial = HERO,
    sponsors: SponsorEditView[] = [],
  ) => {
    renderWithMessages(
      <HeroForm
        initial={initial}
        standard={STANDARD}
        save={save}
        sponsors={sponsors}
        saveSponsors={vi.fn()}
      />,
    );
    return save;
  };

  it("opens on the headline visitors see today, with the optional boxes empty and Hero as the current tab", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: "Hero" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Headline/ })).toHaveValue(STANDARD.title);
    expect(screen.getByRole("textbox", { name: /Eyebrow/ })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: /Subtitle/ })).toHaveValue("");
    expect(screen.getByRole("radio", { name: /Search Desk/ })).toBeChecked();
    expect(
      within(screen.getByRole("navigation", { name: "Site content" })).getByRole("link", {
        name: "Hero",
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("draws the standard subtitle until one is typed, and the eyebrow in Split only", async () => {
    open(undefined, HERO, [PANEL_SPONSOR]);
    const hero = () => picture("site-hero-preview");
    expect(hero()?.textContent).toContain(STANDARD.subtitle);
    await userEvent.type(screen.getByRole("textbox", { name: /Eyebrow/ }), "Tamil Nadu");
    expect(hero()?.textContent).not.toContain("Tamil Nadu");
    await userEvent.click(screen.getByRole("radio", { name: /Split/ }));
    expect(hero()).toHaveAttribute("data-layout", "split");
    expect(hero()?.textContent).toContain("Tamil Nadu");
    await userEvent.type(screen.getByRole("textbox", { name: /Subtitle/ }), "Compare homes.");
    expect(hero()?.textContent).toContain("Compare homes.");
    expect(hero()?.textContent).not.toContain(STANDARD.subtitle);
  });

  it("sends exactly what is in the boxes, then says so and reads the page again", async () => {
    const save = open();
    await userEvent.click(screen.getByRole("radio", { name: /Split/ }));
    await userEvent.type(screen.getByRole("textbox", { name: /Eyebrow/ }), "Tamil Nadu");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      eyebrow: "Tamil Nadu",
      title: STANDARD.title,
      subtitle: "",
      layout: "split",
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.hero.saved.title, {
        description: words.hero.saved.text,
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it("marks a missing headline on its box and says so in the alert", async () => {
    const save = vi.fn().mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: { title: [{ key: "validation.required" }] },
    } satisfies ActionResult<unknown>);
    open(save, { ...HERO, title: "" });
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("1 thing needs attention");
    expect(screen.getByRole("textbox", { name: /Headline/ })).toBeInvalid();
    expect(screen.getByText(en.validation.required)).toBeInTheDocument();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says a failure with no box to blame in a toast", async () => {
    open(vi.fn().mockResolvedValue({ ok: false, code: "RATE_LIMITED", retryAfter: 600 }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(router.refresh).toHaveBeenCalled();
  });

  it("puts the boxes back to what was loaded when Discard is pressed", async () => {
    open();
    await userEvent.clear(screen.getByRole("textbox", { name: /Headline/ }));
    await userEvent.click(screen.getByRole("radio", { name: /Split/ }));
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("textbox", { name: /Headline/ })).toHaveValue(STANDARD.title);
    expect(screen.getByRole("radio", { name: /Search Desk/ })).toBeChecked();
  });
});

const HOMEPAGE: HomepageFormValues = {
  showFeatured: true,
  showProjectTypes: true,
  showDiscovery: true,
  showWhyUs: false,
  showCta: true,
  localities: [
    { label: "Adyar", lat: "13.0067", lng: "80.2573", radiusKm: "4" },
    { label: "Velachery", lat: "12.9815", lng: "80.218", radiusKm: "3" },
  ],
};

describe("UT-homepage-page: the Homepage page (S7-T10)", () => {
  const open = (save = vi.fn().mockResolvedValue(ok), initial = HOMEPAGE) => {
    renderWithMessages(<HomepageForm initial={initial} save={save} />);
    return save;
  };

  it("opens on the saved switches and localities, with Homepage as the current tab", () => {
    open();
    expect(
      screen.getByRole("heading", { level: 1, name: "Homepage sections" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /Why Find Prop/ })).not.toBeChecked();
    expect(screen.getByRole("switch", { name: /Featured listings/ })).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Label 1" })).toHaveValue("Adyar");
    expect(screen.getByRole("textbox", { name: "Latitude 2" })).toHaveValue("12.9815");
    expect(screen.getByRole("combobox", { name: "Radius 1" })).toHaveValue("4");
    expect(
      within(screen.getByRole("navigation", { name: "Site content" })).getByRole("link", {
        name: "Homepage",
      }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByText(/The first 4 also appear as Popular chips/)).toBeInTheDocument();
  });

  it("draws the sections and the localities as the boxes are changed", async () => {
    open();
    const home = () => picture("site-homepage-preview")?.textContent ?? "";
    expect(home()).toContain("Why Find PropOff");
    expect(home()).toContain("Adyar");
    await userEvent.click(screen.getByRole("switch", { name: /Why Find Prop/ }));
    expect(home()).toContain("Why Find PropOn");
    await userEvent.click(screen.getByRole("button", { name: "Remove: Adyar" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove: Velachery" }));
    expect(home()).toContain("Explore by localityOff");
    expect(home()).toContain("Section hidden");
  });

  it("sends the switches and the localities as typed, then says so", async () => {
    const save = open();
    await userEvent.click(screen.getByRole("switch", { name: /Post-property call to action/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      showFeatured: true,
      showProjectTypes: true,
      showDiscovery: true,
      showWhyUs: false,
      showCta: false,
      localities: HOMEPAGE.localities,
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.homepage.saved.title, {
        description: words.homepage.saved.text,
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
  });

  it("adds a locality with the default distance and sends it", async () => {
    const save = open();
    await userEvent.click(screen.getByRole("button", { name: "Add locality" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Label 3" }), "Navalur");
    await userEvent.type(screen.getByRole("textbox", { name: "Latitude 3" }), "12.8458");
    await userEvent.type(screen.getByRole("textbox", { name: "Longitude 3" }), "80.2265");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const sent = save.mock.calls[0]?.[0] as { localities: unknown[] };
    expect(sent.localities[2]).toEqual({
      label: "Navalur",
      lat: "12.8458",
      lng: "80.2265",
      radiusKm: "3",
    });
  });

  it("puts a place outside the area, a repeated name and a missing latitude on their rows", async () => {
    const save = vi.fn().mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: {
        "localities.1.lat": [{ key: "validation.outsideRegion" }],
        "localities.1.label": [{ key: "validation.localityLabelTaken" }],
        "localities.0.lng": [{ key: "validation.required" }],
      },
    } satisfies ActionResult<unknown>);
    open(save);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("3 things need attention");
    expect(screen.getByRole("textbox", { name: "Latitude 2" })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Label 2" })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Longitude 1" })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Latitude 1" })).toBeValid();
    expect(screen.getByText(en.validation.outsideRegion)).toBeInTheDocument();
  });

  it("turns Add off at the limit of 8 and says so", () => {
    const eight = Array.from({ length: 8 }, (_, index) => ({
      label: `Place ${index + 1}`,
      lat: "13",
      lng: "80",
      radiusKm: "3",
    }));
    open(undefined, { ...HOMEPAGE, localities: eight });
    expect(screen.getByRole("button", { name: "Add locality" })).toBeDisabled();
    expect(screen.getByText("You've reached the limit of 8 localities")).toBeInTheDocument();
  });

  it("puts the boxes back to what was loaded when Discard is pressed", async () => {
    open();
    await userEvent.click(screen.getByRole("button", { name: "Remove: Adyar" }));
    await userEvent.click(screen.getByRole("switch", { name: /Featured listings/ }));
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("textbox", { name: "Label 1" })).toHaveValue("Adyar");
    expect(screen.getByRole("switch", { name: /Featured listings/ })).toBeChecked();
  });
});
