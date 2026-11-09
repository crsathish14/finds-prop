// @vitest-environment jsdom
import { createEvent, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SponsorFields, type SponsorFieldsWords } from "../sponsor-fields";
import {
  SponsorImageSlot,
  type SponsorImageSlotProps,
  type SponsorImageSlotWords,
} from "../sponsor-image-slot";

const WORDS: SponsorImageSlotWords = {
  dropTitle: "Drop an image here",
  dropText: "or choose a file",
  choose: "Choose file",
  replace: "Replace",
  remove: "Remove",
  chooseAnother: "Choose another file",
  keep: "Keep as is",
  checking: "Checking the picture",
  previewAlt: "Preview of the chosen picture",
};

const TITLE = "Strip · desktop";

const slot = (over: Partial<SponsorImageSlotProps> = {}): SponsorImageSlotProps => ({
  title: TITLE,
  note: "Shown at 970 × 90 · supply 1940 × 180",
  ratio: { width: 970, height: 90 },
  state: "empty",
  words: WORDS,
  onFile: () => undefined,
  ...over,
});

const picture = (name = "banner.png") => new File(["x"], name, { type: "image/png" });
const root = () => document.querySelector("[data-slot='sponsor-image-slot']");
const input = () => document.querySelector("input[type='file']") as HTMLInputElement;

describe("UT-sponsor-slot: one picture slot of a sponsor (S7-T11)", () => {
  it("names the slot, says the size it is shown at, and keeps the slot's shape", () => {
    render(<SponsorImageSlot {...slot()} />);
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText("Shown at 970 × 90 · supply 1940 × 180")).toBeInTheDocument();
    const box = input().closest("label");
    expect(box).toHaveStyle({ aspectRatio: "970 / 90" });
  });

  it("empty: the file picker is named by the slot, takes only the three picture types, and shows the invitation", () => {
    render(<SponsorImageSlot {...slot()} />);
    expect(screen.getByLabelText(TITLE)).toBe(input());
    expect(input()).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    expect(screen.getByText("Drop an image here")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Choose file: ${TITLE}` })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Replace|Remove/ })).not.toBeInTheDocument();
  });

  it("hands up the file that is chosen, and clears the picker so the same file can be chosen again", async () => {
    const onFile = vi.fn();
    render(<SponsorImageSlot {...slot({ onFile })} />);
    const file = picture();
    await userEvent.upload(input(), file);
    expect(onFile).toHaveBeenCalledWith(file);
    expect(input().value).toBe("");
  });

  it("opens the picker from its button", async () => {
    render(<SponsorImageSlot {...slot()} />);
    const open = vi.spyOn(input(), "click");
    await userEvent.click(screen.getByRole("button", { name: `Choose file: ${TITLE}` }));
    expect(open).toHaveBeenCalled();
  });

  it("takes a file dropped on the picture box", () => {
    const onFile = vi.fn();
    render(<SponsorImageSlot {...slot({ onFile })} />);
    const file = picture("dropped.png");
    const drop = createEvent.drop(input().closest("label") as HTMLElement);
    Object.defineProperty(drop, "dataTransfer", { value: { files: [file] } });
    fireEvent(input().closest("label") as HTMLElement, drop);
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it("filled: shows the picture and says it fills the slot, with Replace and Remove named for the slot", async () => {
    const onRemove = vi.fn();
    render(
      <SponsorImageSlot
        {...slot({
          state: "filled",
          image: { src: "/design-lab/ads/strip-970x90-a.svg", alt: "Strip banner" },
          status: { title: "Fills the slot", text: "1940 × 180 · WEBP · 96 KB" },
          onRemove,
        })}
      />,
    );
    expect(screen.getByAltText("Strip banner")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Fills the slot1940 × 180 · WEBP · 96 KB");
    expect(screen.getByRole("button", { name: `Replace: ${TITLE}` })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: `Remove: ${TITLE}` }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("describes the picture with the words it is given when it has no description of its own", () => {
    render(
      <SponsorImageSlot
        {...slot({ state: "filled", image: { src: "/design-lab/ads/strip-970x90-a.svg" } })}
      />,
    );
    expect(screen.getByAltText("Preview of the chosen picture")).toBeInTheDocument();
  });

  it("near miss: says the picture is shown whole, shows it whole, and lets it be kept as it is", async () => {
    const onKeep = vi.fn();
    render(
      <SponsorImageSlot
        {...slot({
          state: "near",
          image: { src: "/design-lab/ads/near-miss-strip-970x120.svg" },
          status: { title: "Will be shown whole on a plain background", text: "Not cropped." },
          onKeep,
        })}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Will be shown whole on a plain background",
    );
    expect(screen.getByAltText("Preview of the chosen picture")).toHaveClass("object-contain");
    await userEvent.click(screen.getByRole("button", { name: `Keep as is: ${TITLE}` }));
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: /Remove/ })).not.toBeInTheDocument();
  });

  it("rejected: an alert with the reason, the refused file's name in the box, and only Choose another file", () => {
    render(
      <SponsorImageSlot
        {...slot({
          state: "rejected",
          fileName: "banner-mobile.svg",
          status: { title: "Rejected: SVG isn't accepted", text: "Upload a JPG, PNG or WEBP." },
        })}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Rejected: SVG isn't accepted");
    expect(screen.getByText("banner-mobile.svg")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: `Choose another file: ${TITLE}` }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Replace|Remove|Keep/ })).not.toBeInTheDocument();
    expect(root()).toHaveAttribute("data-state", "rejected");
  });

  it("rejected with a picture: shows the picture so the person can see why", () => {
    render(
      <SponsorImageSlot
        {...slot({
          state: "rejected",
          image: { src: "/design-lab/ads/near-miss-panel-524x600.svg", alt: "Too tall" },
          status: { title: "Rejected: wrong shape", text: "Supply a wide banner." },
        })}
      />,
    );
    expect(screen.getByAltText("Too tall")).toBeInTheDocument();
  });

  it("checking: busy, nothing can be pressed or dropped, and it says so", () => {
    const onFile = vi.fn();
    render(<SponsorImageSlot {...slot({ state: "checking", onFile })} />);
    expect(root()).toHaveAttribute("aria-busy", "true");
    expect(input()).toBeDisabled();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByText("Checking the picture").length).toBeGreaterThan(0);
    const drop = createEvent.drop(input().closest("label") as HTMLElement);
    Object.defineProperty(drop, "dataTransfer", { value: { files: [picture()] } });
    fireEvent(input().closest("label") as HTMLElement, drop);
    expect(onFile).not.toHaveBeenCalled();
  });

  it("disabled while saving: every button and the picker are off", () => {
    render(
      <SponsorImageSlot
        {...slot({
          state: "filled",
          image: { src: "/design-lab/ads/strip-970x90-a.svg" },
          status: { title: "Fills the slot", text: "1940 × 180" },
          onRemove: () => undefined,
          disabled: true,
        })}
      />,
    );
    expect(input()).toBeDisabled();
    expect(screen.getByRole("button", { name: `Replace: ${TITLE}` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Remove: ${TITLE}` })).toBeDisabled();
  });
});

const FIELD_WORDS: SponsorFieldsWords = {
  advertiser: "Advertiser name",
  advertiserPlaceholder: "Name shown to staff only",
  alt: "Alt text",
  altPlaceholder: "Describe the banner",
  altHint: "Read aloud by screen readers.",
  href: "Destination link",
  hrefPlaceholder: "https://",
  hrefHint: "Opens in a new tab. Must start with https://.",
  active: { label: "Active", hint: "Inactive sponsors are never shown." },
  images: { title: "Banner images", text: "Finished images.", closing: "Both make it ready." },
};

const VALUES = {
  advertiser: "Sample Developer",
  alt: "Sample banner",
  href: "https://sample.example",
  active: true,
};

const SLOTS = ["Strip · desktop", "Strip · phone", "Panel · desktop", "Panel · phone"].map(
  (title, index) => ({ key: `slot-${index}`, ...slot({ title }) }),
);

describe("UT-sponsor-fields: the Add and Edit sponsor form (S7-T11)", () => {
  const setup = (props: Partial<React.ComponentProps<typeof SponsorFields>> = {}) => {
    const onChange = vi.fn();
    render(
      <SponsorFields
        values={VALUES}
        onChange={onChange}
        slots={SLOTS}
        words={FIELD_WORDS}
        {...props}
      />,
    );
    return onChange;
  };

  it("labels every box, with its hint, and marks the three as needed", () => {
    setup();
    expect(screen.getByRole("textbox", { name: /Advertiser name/ })).toHaveValue(
      "Sample Developer",
    );
    expect(screen.getByRole("textbox", { name: /Alt text/ })).toHaveValue("Sample banner");
    expect(screen.getByRole("textbox", { name: /Destination link/ })).toHaveValue(
      "https://sample.example",
    );
    expect(screen.getByRole("textbox", { name: /Destination link/ })).toHaveAccessibleDescription(
      "Opens in a new tab. Must start with https://.",
    );
    expect(screen.getAllByText("*").length).toBeGreaterThanOrEqual(0);
    expect(screen.getByRole("textbox", { name: /Alt text/ })).toBeRequired();
  });

  it("passes up the whole values with only the typed box changed", async () => {
    const onChange = setup();
    await userEvent.type(screen.getByRole("textbox", { name: /Advertiser name/ }), "!");
    expect(onChange).toHaveBeenLastCalledWith({ ...VALUES, advertiser: "Sample Developer!" });
  });

  it("flips Active from its switch or from its whole label row, and reads its line with it", async () => {
    const onChange = setup();
    const toggle = screen.getByRole("switch", { name: /Active/ });
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAccessibleDescription("Inactive sponsors are never shown.");
    await userEvent.click(screen.getByText("Inactive sponsors are never shown."));
    expect(onChange).toHaveBeenLastCalledWith({ ...VALUES, active: false });
  });

  it("shows a problem beside its box and ties it to the box", () => {
    setup({ errors: { href: "The link must start with https://." } });
    expect(screen.getByRole("textbox", { name: /Destination link/ })).toBeInvalid();
    expect(screen.getByText("The link must start with https://.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Alt text/ })).toBeValid();
  });

  it("shows the four slots, in order, in a group named by the pictures' heading", () => {
    setup();
    const group = screen.getByRole("region", { name: "Banner images" });
    const titles = [...group.querySelectorAll("[data-slot='sponsor-image-slot'] p.font-bold")].map(
      (node) => node.textContent,
    );
    expect(titles).toEqual([
      "Strip · desktop",
      "Strip · phone",
      "Panel · desktop",
      "Panel · phone",
    ]);
    expect(within(group).getByText("Both make it ready.")).toBeInTheDocument();
  });

  it("turns every box, the switch and every slot off while saving", () => {
    setup({ disabled: true });
    for (const box of screen.getAllByRole("textbox")) expect(box).toBeDisabled();
    expect(screen.getByRole("switch", { name: /Active/ })).toBeDisabled();
    for (const picker of document.querySelectorAll("input[type='file']")) {
      expect(picker).toBeDisabled();
    }
  });
});
