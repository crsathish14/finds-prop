// @vitest-environment jsdom
import { fireEvent, screen, within } from "@testing-library/react";
import { Mail } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { AmenityChips } from "../amenity-chips";
import { ChoiceCards } from "../choice-cards";
import { DraftsList, type DraftItem } from "../drafts-list";
import { GateCard } from "../gate-card";
import { NextSteps } from "../next-steps";
import { ReviewList } from "../review-list";
import { WizardFooter } from "../wizard-footer";
import { WizardShell } from "../wizard-shell";

const STEPS = [
  { label: "Basics", state: "done" as const },
  { label: "Details", state: "current" as const },
  { label: "Photos", state: "upcoming" as const },
];

describe("WizardShell: the frame of the post-property wizard (S6-T02)", () => {
  it("shows the heading with its emphasis, the line under it, the steps and the step's content", () => {
    renderWithMessages(
      <WizardShell
        title="Post your property"
        emphasis="property"
        description="Your listing is reviewed before it goes live."
        steps={STEPS}
        progressLabel="Step 2 of 3: Details"
        footer={<p>footer</p>}
      >
        <p>the step</p>
      </WizardShell>,
    );
    const heading = screen.getByRole("heading", { level: 1, name: "Post your property" });
    expect(heading.querySelector("em")?.textContent).toBe("property");
    expect(screen.getByText("Your listing is reviewed before it goes live.")).toBeVisible();
    expect(screen.getByText("the step")).toBeVisible();
    expect(screen.getByText("footer")).toBeVisible();
    // The step list marks the current step, and the phone line says where the reader is.
    expect(screen.getByText("Details").closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getAllByText("Step 2 of 3: Details").length).toBeGreaterThan(0);
  });

  it("puts an alert at the top of the card, names the card by the heading, and takes another heading level", () => {
    renderWithMessages(
      <WizardShell
        title="Post your property"
        description="d"
        steps={STEPS}
        progressLabel="Step 2 of 3: Details"
        alert={<p role="alert">We couldn&apos;t submit your listing</p>}
        footer={null}
        titleAs="h2"
        titleId="lab-title"
      >
        <p>the step</p>
      </WizardShell>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Post your property" })).toHaveAttribute(
      "id",
      "lab-title",
    );
    const card = screen.getByRole("region", { name: "Post your property" });
    expect(within(card).getByRole("alert")).toHaveTextContent("We couldn't submit your listing");
  });
});

describe("WizardFooter: Back, Save draft and Continue (S6-T02)", () => {
  it("leaves Back out on the first step and calls what each button is given", () => {
    const next = vi.fn();
    const save = vi.fn();
    renderWithMessages(
      <WizardFooter
        saveDraft={{ label: "Save draft", onClick: save }}
        next={{ label: "Continue", onClick: next, kind: "continue" }}
      />,
    );
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(save).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("shows Back from the second step and keeps the buttons in reading order", () => {
    const back = vi.fn();
    renderWithMessages(
      <WizardFooter
        back={{ label: "Back", onClick: back }}
        saveDraft={{ label: "Save draft", onClick: vi.fn() }}
        next={{ label: "Continue", onClick: vi.fn(), kind: "continue" }}
      />,
    );
    const names = screen.getAllByRole("button").map((button) => button.textContent);
    expect(names).toEqual(["Back", "Save draft", "Continue"]);
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("holds the label and ignores clicks while submitting", () => {
    const next = vi.fn();
    renderWithMessages(
      <WizardFooter next={{ label: "Submitting", onClick: next, kind: "submit", loading: true }} />,
    );
    const button = screen.getByRole("button", { name: /Submitting/ });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(next).not.toHaveBeenCalled();
  });

  it("disables what it is told to", () => {
    renderWithMessages(
      <WizardFooter
        back={{ label: "Back", onClick: vi.fn(), disabled: true }}
        next={{ label: "Continue", onClick: vi.fn(), kind: "continue", disabled: true }}
      />,
    );
    expect(screen.getByRole("button", { name: "Back" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});

describe("ChoiceCards: choose one option drawn as cards (S6-T02)", () => {
  const options = [
    { value: "sale", label: "Sell", hint: "List a home for sale" },
    { value: "rent", label: "Rent out", hint: "List a home for rent" },
  ];

  it("is a group named by its legend with one radio per option, the chosen one checked", () => {
    renderWithMessages(
      <ChoiceCards
        legend="I want to"
        name="kind"
        options={options}
        value="sale"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("group", { name: "I want to" })).toBeVisible();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(screen.getByRole("radio", { name: /Sell/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Rent out/ })).not.toBeChecked();
    expect(screen.getByText("List a home for rent")).toBeVisible();
  });

  it("calls onChange with the value of the card chosen", () => {
    const onChange = vi.fn();
    renderWithMessages(
      <ChoiceCards
        legend="I want to"
        name="kind"
        options={options}
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("radio", { name: /Rent out/ }));
    expect(onChange).toHaveBeenCalledWith("rent");
  });

  it("shows an error as text tied to the group, and can be disabled", () => {
    renderWithMessages(
      <ChoiceCards
        legend="I want to"
        name="kind"
        options={options}
        value={null}
        onChange={vi.fn()}
        error="This field is required."
        disabled
      />,
    );
    const group = screen.getByRole("group", { name: "I want to" });
    expect(group).toHaveAttribute("aria-describedby");
    expect(screen.getByText("This field is required.")).toBeVisible();
    expect(screen.getByRole("radio", { name: /Sell/ })).toBeDisabled();
  });
});

describe("AmenityChips: toggle chips (S6-T02)", () => {
  const options = [
    { value: "Gym", label: "Gym" },
    { value: "Lift", label: "Lift" },
    { value: "Clubhouse", label: "Clubhouse" },
  ];

  it("is a named group of toggle buttons that say which are chosen", () => {
    renderWithMessages(
      <AmenityChips label="Amenities" options={options} selected={["Lift"]} onToggle={vi.fn()} />,
    );
    const group = screen.getByRole("group", { name: "Amenities" });
    expect(within(group).getByRole("button", { name: "Lift" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: "Gym" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onToggle with the value of the chip pressed, and is off when disabled", () => {
    const onToggle = vi.fn();
    const view = renderWithMessages(
      <AmenityChips label="Amenities" options={options} selected={[]} onToggle={onToggle} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Clubhouse" }));
    expect(onToggle).toHaveBeenCalledWith("Clubhouse");
    view.unmount();
    renderWithMessages(
      <AmenityChips
        label="Amenities"
        options={options}
        selected={[]}
        onToggle={onToggle}
        disabled
      />,
    );
    expect(screen.getByRole("button", { name: "Gym" })).toBeDisabled();
  });
});

describe("ReviewList and NextSteps: the last step (S6-T02)", () => {
  it("lists each answer under its label with an Edit button that says what it edits", () => {
    const onEdit = vi.fn();
    renderWithMessages(
      <ReviewList
        rows={[
          {
            id: "price",
            label: "Price",
            value: "₹1.25 Cr",
            editText: "Edit",
            editFor: "price",
            onEdit,
          },
          {
            id: "size",
            label: "Size",
            value: "3 BHK",
            editText: "Edit",
            editFor: "size",
            onEdit: vi.fn(),
          },
        ]}
      />,
    );
    expect(screen.getByText("Price").tagName).toBe("DT");
    expect(screen.getByText("₹1.25 Cr")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Edit price" }));
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Edit size" })).toBeVisible();
  });

  it("keeps the Edit buttons inside the answers, as a description list allows", () => {
    renderWithMessages(
      <ReviewList
        rows={[
          {
            id: "a",
            label: "Photos",
            value: "3 photos",
            editText: "Edit",
            editFor: "photos",
            onEdit: vi.fn(),
          },
        ]}
      />,
    );
    const button = screen.getByRole("button", { name: "Edit photos" });
    expect(button.closest("dd")).not.toBeNull();
    expect(button.parentElement?.parentElement?.tagName).toBe("DIV");
  });

  it("shows a dash for an empty answer", () => {
    renderWithMessages(
      <ReviewList
        rows={[
          {
            id: "a",
            label: "Description",
            value: "",
            editText: "Edit",
            editFor: "description",
            onEdit: vi.fn(),
          },
        ]}
      />,
    );
    expect(screen.getByText("–")).toBeVisible();
  });

  it("explains what happens next under a heading of the level asked for", () => {
    renderWithMessages(
      <NextSteps title="What happens next">It stays hidden until it is approved.</NextSteps>,
    );
    expect(screen.getByRole("heading", { level: 3, name: "What happens next" })).toBeVisible();
    expect(screen.getByText("It stays hidden until it is approved.")).toBeVisible();
  });
});

describe("GateCard: the posting gate (S6-T02)", () => {
  it("shows the title as the page heading, the description, the form, the note and the link", () => {
    renderWithMessages(
      <GateCard
        icon={Mail}
        title="Verify your email to post a property"
        description="It takes a minute."
        note="Nothing you've entered is lost."
        footer={<a href="#browse">Not now, back to browsing</a>}
      >
        <button type="button">Send verification link</button>
      </GateCard>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Verify your email to post a property" }),
    ).toBeVisible();
    expect(screen.getByText("It takes a minute.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Send verification link" })).toBeVisible();
    expect(screen.getByText("Nothing you've entered is lost.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Not now, back to browsing" })).toBeVisible();
  });

  it("is a status region only when asked, so a change is announced", () => {
    const view = renderWithMessages(<GateCard icon={Mail} title="t" description="d" />);
    expect(screen.queryByRole("status")).toBeNull();
    view.unmount();
    renderWithMessages(
      <GateCard icon={Mail} title="Check your email" description="d" status tone="success" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Check your email");
  });
});

describe("DraftsList: the listings someone has started (S6-T02)", () => {
  const item = (id: string, title: string, overrides: Partial<DraftItem> = {}): DraftItem => ({
    id,
    title,
    meta: "For sale · Apartment",
    updated: "Saved 7 Nov",
    continueHref: `/post-property/${id}`,
    continueText: "Continue",
    continueFor: title,
    deleteText: "Delete",
    deleteFor: title,
    onDelete: vi.fn(),
    ...overrides,
  });

  it("lists each draft with a Continue link and a Delete button that name the draft", () => {
    const onDelete = vi.fn();
    renderWithMessages(
      <DraftsList
        heading="Your drafts"
        items={[item("a", "3 BHK apartment", { onDelete }), item("b", "Sea view villa")]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Your drafts" })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Continue 3 BHK apartment" })).toHaveAttribute(
      "href",
      "/post-property/a",
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete 3 BHK apartment" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Delete Sea view villa" })).toBeVisible();
  });

  it("keeps the row of a draft that is being deleted, and ignores another press", () => {
    const onDelete = vi.fn();
    renderWithMessages(
      <DraftsList
        heading="Your drafts"
        items={[item("a", "3 BHK apartment", { onDelete, pending: true })]}
      />,
    );
    const button = screen.getByRole("button", { name: /Delete 3 BHK apartment/ });
    expect(button).toHaveAttribute("aria-busy", "true");
    fireEvent.click(button);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Continue 3 BHK apartment" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
