// @vitest-environment jsdom
import { optionTexts } from "../../../../tests/select";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FormSection } from "@/components/patterns/form-section";
import { TagListField, type TagListWords } from "@/components/patterns/tag-list-field";
import { ProjectFields, type ProjectFieldValues, type ProjectFieldsWords } from "../project-fields";
import { ProjectFormLayout } from "../project-form-layout";
import { ProjectSaveBar } from "../project-save-bar";
import { ProjectSectionNav, type ProjectSectionItem } from "../project-section-nav";

const TAGS: TagListWords = {
  placeholder: "Add another",
  add: "Add",
  remove: "Remove",
  suggestions: "Suggestions",
  full: "The list is full.",
};

describe("UT-tag-list-field: a list of short phrases (S7-T02)", () => {
  const setup = (props: Partial<React.ComponentProps<typeof TagListField>> = {}) => {
    const onChange = vi.fn();
    render(
      <TagListField
        label="Amenities"
        tags={[]}
        onChange={onChange}
        max={3}
        words={TAGS}
        {...props}
      />,
    );
    return onChange;
  };

  it("adds what was typed on Enter, with the spaces tidied", async () => {
    const onChange = setup();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Amenities" }),
      "  Club   house {Enter}",
    );
    expect(onChange).toHaveBeenCalledWith(["Club house"]);
  });

  it("adds on the Add button, which is off while the box is empty", async () => {
    const onChange = setup();
    const add = screen.getByRole("button", { name: "Add" });
    expect(add).toBeDisabled();
    await userEvent.type(screen.getByRole("textbox", { name: "Amenities" }), "Gym");
    await userEvent.click(add);
    expect(onChange).toHaveBeenCalledWith(["Gym"]);
  });

  it("adds on a comma and keeps the comma out of the phrase", async () => {
    const onChange = setup();
    await userEvent.type(screen.getByRole("textbox", { name: "Amenities" }), "Gym,");
    expect(onChange).toHaveBeenCalledWith(["Gym"]);
  });

  it("ignores an empty phrase and one already in the list, whatever its capitals", async () => {
    const onChange = setup({ tags: ["Gym"] });
    await userEvent.type(screen.getByRole("textbox", { name: "Amenities" }), "gym{Enter}");
    await userEvent.type(screen.getByRole("textbox", { name: "Amenities" }), "   {Enter}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("cuts a phrase to the longest allowed", async () => {
    const onChange = setup({ maxLength: 5 });
    await userEvent.type(screen.getByRole("textbox", { name: "Amenities" }), "Swimming{Enter}");
    expect(onChange).toHaveBeenCalledWith(["Swimm"]);
  });

  it("shows each phrase with an x that names it, and removes only that one", async () => {
    const onChange = setup({ tags: ["Gym", "Lift"] });
    const list = screen.getByRole("list", { name: "Amenities" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
    await userEvent.click(screen.getByRole("button", { name: "Remove: Gym" }));
    expect(onChange).toHaveBeenCalledWith(["Lift"]);
  });

  it("shows how many are used, and when full turns the box and Add off and says so", () => {
    setup({ tags: ["A1", "B2", "C3"] });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByText("The list is full.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Amenities" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove: A1" })).toBeEnabled();
  });

  it("offers the suggestions not yet added, and a tap adds one", async () => {
    const onChange = setup({ tags: ["Gym"], suggestions: ["Gym", "Lift", "Clubhouse"] });
    const group = screen.getByRole("group", { name: "Suggestions" });
    expect(within(group).queryByRole("button", { name: "Gym" })).toBeNull();
    await userEvent.click(within(group).getByRole("button", { name: "Lift" }));
    expect(onChange).toHaveBeenCalledWith(["Gym", "Lift"]);
  });

  it("ties the hint and the error to the box", () => {
    setup({ hint: "Short phrases.", error: "Too many." });
    const box = screen.getByRole("textbox", { name: "Amenities" });
    expect(box).toHaveAccessibleDescription("Short phrases. Too many.");
    expect(box).toBeInvalid();
  });

  it("turns everything off when disabled, including the x", async () => {
    const onChange = setup({ tags: ["Gym"], suggestions: ["Lift"], disabled: true });
    expect(screen.getByRole("textbox", { name: "Amenities" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Lift" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Remove: Gym" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("UT-form-section: one titled block (S7-T02)", () => {
  it("is a region named by its heading, with the anchor id and the description", () => {
    render(
      <FormSection id="basics" title="Basics" description="The essentials.">
        <p>boxes</p>
      </FormSection>,
    );
    const region = screen.getByRole("region", { name: "Basics" });
    expect(region).toHaveAttribute("id", "basics");
    expect(within(region).getByRole("heading", { level: 2, name: "Basics" })).toBeInTheDocument();
    expect(within(region).getByText("The essentials.")).toBeInTheDocument();
  });
});

const ITEMS: ProjectSectionItem[] = [
  { id: "basics", label: "Basics", state: "done" },
  { id: "location", label: "Location", state: "error" },
  { id: "seo", label: "SEO", state: "idle" },
];
const NAV_WORDS = { nav: "Form sections", done: "Complete", error: "Needs attention" };

describe("UT-project-section-nav: the list of sections (S7-T02)", () => {
  it("is a named navigation of links to each section's anchor", () => {
    render(<ProjectSectionNav sections={ITEMS} current="basics" words={NAV_WORDS} />);
    const nav = screen.getByRole("navigation", { name: "Form sections" });
    expect(within(nav).getByRole("link", { name: /Location/ })).toHaveAttribute(
      "href",
      "#location",
    );
    expect(within(nav).getByRole("link", { name: /SEO/ })).toHaveAttribute("href", "#seo");
  });

  it("marks only the current link", () => {
    render(<ProjectSectionNav sections={ITEMS} current="location" words={NAV_WORDS} />);
    expect(screen.getByRole("link", { name: /Location/ })).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("link", { name: /Basics/ })).not.toHaveAttribute("aria-current");
  });

  it("says done and needs-attention in words, and says nothing for a section with no state", () => {
    render(<ProjectSectionNav sections={ITEMS} current="basics" words={NAV_WORDS} />);
    expect(screen.getByRole("link", { name: /^Basics\s?Complete$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Location\s?Needs attention$/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "SEO" })).toBeInTheDocument();
  });

  it("tells the page which section was chosen", async () => {
    const onSelect = vi.fn();
    render(
      <ProjectSectionNav sections={ITEMS} current="basics" words={NAV_WORDS} onSelect={onSelect} />,
    );
    await userEvent.click(screen.getByRole("link", { name: /SEO/ }));
    expect(onSelect).toHaveBeenCalledWith("seo");
  });
});

const FIELD_WORDS: ProjectFieldsWords = {
  basics: { title: "Basics", description: "The essentials." },
  location: { title: "Location", description: "Where it is." },
  rera: { title: "RERA", description: "Registration." },
  details: { title: "Details", description: "More." },
  media: { title: "Media", description: "Pictures." },
  seo: { title: "SEO", description: "Search." },
  name: "Project name",
  builder: "Builder",
  builderHint: "Only admins can assign.",
  unset: "Not set",
  projectType: "Project type",
  propertyType: "Property type",
  offerType: "This project is for",
  plotStatus: "Plot status",
  villaType: "Villa type",
  projectStatus: "Status",
  price: "Starting price",
  priceType: "Price type",
  areaMin: "Minimum area",
  areaMax: "Maximum area",
  bhk: "BHK options",
  landArea: "Land area",
  possession: "Possession",
  contactPhone: "Contact phone",
  city: "City",
  locality: "Locality",
  address: "Address",
  latitude: "Latitude",
  longitude: "Longitude",
  advantages: "Location advantages",
  nearby: "Nearby places",
  reraApplicable: "RERA applicable",
  reraNumber: "RERA number",
  reraReason: "Why is RERA not applicable?",
  reraReasonHint: "This reason will be shown publicly.",
  description: "Description",
  specifications: "Specifications",
  amenities: "Amenities",
  seoTitle: "Page title",
  slug: "Slug",
  slugHint: "Page address: /projects/",
  slugLockedHint: "Cannot be changed once approved.",
  seoDescription: "Meta description",
  optional: "(optional)",
  tags: TAGS,
};

const OPTIONS = {
  projectTypes: [{ value: "residential", label: "Residential" }],
  propertyTypes: [{ value: "apartment", label: "Apartment" }],
  offerTypes: [{ value: "sale", label: "Sale" }],
  plotStatuses: [],
  villaTypes: [],
  priceTypes: [{ value: "basic", label: "Basic price" }],
  statuses: [{ value: "new_launch", label: "New launch" }],
};

const VALUES: ProjectFieldValues = {
  name: "Kadal Vista",
  builderId: "b1",
  projectType: "",
  propertyType: "",
  offerType: "",
  plotStatus: "",
  villaType: "",
  projectStatus: "",
  price: "",
  priceType: "",
  areaMinSqft: "",
  areaMaxSqft: "",
  bhkOptions: [3],
  landAreaAcres: "",
  possessionDate: "",
  contactPhone: "",
  city: "Chennai",
  locality: "OMR",
  address: "",
  latitude: "",
  longitude: "",
  advantages: [],
  nearby: [],
  reraApplicable: true,
  reraNumber: "TN/1",
  reraNotApplicableReason: "",
  description: "",
  specifications: "",
  amenities: [],
  seoTitle: "",
  slug: "kadal-vista",
  seoDescription: "",
};

const APPLIES = {
  offerType: false,
  plotStatus: false,
  villaType: false,
  bedrooms: true,
  area: false,
  possession: true,
};

/** The fields with their own state, as a page keeps it; the spy sees every change. */
function Live({
  spy,
  ...props
}: Partial<React.ComponentProps<typeof ProjectFields>> & {
  spy?: (name: string, value: unknown) => void;
}) {
  const [values, setValues] = useState(VALUES);
  return (
    <ProjectFields
      values={values}
      onChange={(name, value) => {
        spy?.(name, value);
        setValues((now) => ({ ...now, [name]: value }));
      }}
      options={OPTIONS}
      applies={APPLIES}
      words={FIELD_WORDS}
      {...props}
    />
  );
}

describe("UT-project-fields: the sections of the project form (S7-T02)", () => {
  it("has the five sections as named regions, and the media one only when it is given", () => {
    const { rerender } = render(<Live />);
    for (const name of ["Basics", "Location", "RERA", "Details", "SEO"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole("region", { name: "Media" })).toBeNull();
    rerender(<Live media={<p>the uploader</p>} />);
    expect(screen.getByRole("region", { name: "Media" })).toHaveTextContent("the uploader");
  });

  it("shows the Builder box only when the builders are given (the admin), and requires it", () => {
    const { rerender } = render(<Live />);
    expect(screen.queryByLabelText(/Builder/)).toBeNull();
    rerender(<Live options={{ ...OPTIONS, builders: [{ value: "b1", label: "Kadal Homes" }] }} />);
    const box = screen.getByLabelText(/Builder/);
    expect(box).toBeRequired();
    expect(box).toHaveAccessibleDescription("Only admins can assign.");
  });

  it("requires the name, the types, the status, the price, the locality and the slug, and marks the rest optional", () => {
    render(<Live />);
    for (const label of [
      /Project name/,
      /Project type/,
      /Property type/,
      /Status/,
      /Possession/,
      /Starting price/,
      /Price type/,
      /Locality/,
      /Slug/,
    ]) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
    expect(screen.getByLabelText(/Address/)).not.toBeRequired();
    expect(screen.getByLabelText(/Land area/)).not.toBeRequired();
  });

  it("shows only the boxes that apply to this kind of project", () => {
    const { rerender } = render(<Live />);
    expect(screen.getByRole("group", { name: /BHK options/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Possession/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/This project is for/)).toBeNull();
    expect(screen.queryByLabelText(/Minimum area/)).toBeNull();
    expect(screen.queryByLabelText(/Maximum area/)).toBeNull();
    rerender(
      <Live
        applies={{
          offerType: true,
          plotStatus: false,
          villaType: false,
          bedrooms: false,
          area: true,
          possession: false,
        }}
      />,
    );
    expect(screen.queryByRole("group", { name: /BHK options/ })).toBeNull();
    expect(screen.queryByLabelText(/Possession/)).toBeNull();
    expect(screen.getByLabelText(/This project is for/)).toBeRequired();
    expect(screen.getByLabelText(/Minimum area/)).toBeRequired();
    expect(screen.getByLabelText(/Maximum area/)).toBeRequired();
  });

  it("asks for the possession as a month", () => {
    render(<Live />);
    expect(screen.getByLabelText(/Possession/)).toHaveAttribute("type", "month");
  });

  it("reports a typed value by box name", async () => {
    const spy = vi.fn();
    render(<Live spy={spy} />);
    await userEvent.type(screen.getByLabelText(/Starting price/), "7");
    expect(spy).toHaveBeenLastCalledWith("price", "7");
  });

  it("offers each choice list with an empty first choice", async () => {
    render(<Live />);
    const type = screen.getByLabelText(/Project type/);
    expect(await optionTexts(type)).toEqual(["Not set", "Residential"]);
  });

  it("keeps the BHK counts in order, and shows a count outside the usual ones", async () => {
    const spy = vi.fn();
    render(<Live spy={spy} />);
    const group = screen.getByRole("group", { name: /BHK options/ });
    expect(within(group).getAllByRole("checkbox")).toHaveLength(5);
    await userEvent.click(within(group).getByRole("checkbox", { name: "1" }));
    expect(spy).toHaveBeenLastCalledWith("bhkOptions", [1, 3]);
    await userEvent.click(within(group).getByRole("checkbox", { name: "3" }));
    expect(spy).toHaveBeenLastCalledWith("bhkOptions", [1]);
  });

  it("shows a stored count that is not one of the usual ones", () => {
    const view = render(
      <ProjectFields
        values={{ ...VALUES, bhkOptions: [0, 7] }}
        onChange={() => undefined}
        options={OPTIONS}
        applies={APPLIES}
        words={FIELD_WORDS}
      />,
    );
    const group = within(view.container).getByRole("group", { name: /BHK options/ });
    expect(within(group).getAllByRole("checkbox")).toHaveLength(7);
  });

  it("asks for the RERA number, or for the reason when RERA does not apply, and says the reason is public", async () => {
    const spy = vi.fn();
    render(<Live spy={spy} />);
    expect(screen.getByLabelText(/RERA number/)).toBeRequired();
    expect(screen.queryByLabelText(/Why is RERA not applicable/)).toBeNull();
    await userEvent.click(screen.getByRole("switch", { name: "RERA applicable" }));
    expect(spy).toHaveBeenLastCalledWith("reraApplicable", false);
    expect(screen.queryByLabelText(/RERA number/)).toBeNull();
    const reason = screen.getByLabelText(/Why is RERA not applicable/);
    expect(reason).toBeRequired();
    expect(reason).toHaveAccessibleDescription("This reason will be shown publicly.");
    await userEvent.type(reason, "Small layout");
    expect(spy).toHaveBeenLastCalledWith("reraNotApplicableReason", "Small layout");
    await userEvent.click(screen.getByRole("switch", { name: "RERA applicable" }));
    expect(screen.getByLabelText(/RERA number/)).toBeRequired();
  });

  it("shows the page address under the slug, and says why it is locked when it is", () => {
    const { rerender } = render(<Live />);
    expect(screen.getByLabelText(/Slug/)).toHaveAccessibleDescription(
      "Page address: /projects/kadal-vista",
    );
    rerender(<Live slugLocked />);
    const slug = screen.getByLabelText(/Slug/);
    expect(slug).toHaveAttribute("readonly");
    expect(slug).toHaveAccessibleDescription("Cannot be changed once approved.");
  });

  it("shows each error beside its box and marks the box invalid", () => {
    render(<Live errors={{ name: "Enter the project name.", price: "Enter the price." }} />);
    expect(screen.getByLabelText(/Project name/)).toBeInvalid();
    expect(screen.getByLabelText(/Project name/)).toHaveAccessibleDescription(
      "Enter the project name.",
    );
    expect(screen.getByLabelText(/Starting price/)).toBeInvalid();
    expect(screen.getByLabelText(/Locality/)).toBeValid();
  });

  it("shows the three lists with their own limits", () => {
    render(<Live />);
    expect(
      within(screen.getByRole("region", { name: "Location" })).getAllByText("0 / 20"),
    ).toHaveLength(2);
    expect(
      within(screen.getByRole("region", { name: "Details" })).getByText("0 / 30"),
    ).toBeInTheDocument();
  });

  it("turns every box off while saving", () => {
    render(<Live disabled />);
    for (const box of screen.getAllByRole("textbox")) expect(box).toBeDisabled();
    expect(screen.getByRole("switch", { name: "RERA applicable" })).toBeDisabled();
    for (const check of screen.getAllByRole("checkbox")) expect(check).toBeDisabled();
  });
});

describe("UT-project-save-bar: the bar under the form (S7-T02)", () => {
  it("shows the note, Cancel and a Save button that submits", async () => {
    const onCancel = vi.fn();
    render(
      <ProjectSaveBar
        note="Saving sends this project for approval."
        words={{ cancel: "Cancel", save: "Save project", saving: "Saving" }}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText("Saving sends this project for approval.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save project" })).toHaveAttribute("type", "submit");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("says Saving, is busy and cannot be cancelled while saving", () => {
    render(
      <ProjectSaveBar
        note="x"
        saving
        words={{ cancel: "Cancel", save: "Save project", saving: "Saving" }}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Saving" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("sticks to the bottom of the area unless told not to", () => {
    const words = { cancel: "Cancel", save: "Save project", saving: "Saving" };
    const { container, rerender } = render(
      <ProjectSaveBar note="x" words={words} onCancel={() => undefined} />,
    );
    expect(container.firstElementChild).toHaveClass("sticky");
    rerender(<ProjectSaveBar note="x" words={words} sticky={false} onCancel={() => undefined} />);
    expect(container.firstElementChild).not.toHaveClass("sticky");
  });

  it("can be switched off when there is nothing to save", () => {
    render(
      <ProjectSaveBar
        note="x"
        disabled
        words={{ cancel: "Cancel", save: "Save project", saving: "Saving" }}
        onCancel={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: "Save project" })).toBeDisabled();
  });
});

describe("UT-project-form-layout: where the parts sit (S7-T02)", () => {
  it("keeps the reading order: alert, section list, sections, side boxes, save bar", () => {
    render(
      <ProjectFormLayout
        top={<p>alert</p>}
        nav={<p>nav</p>}
        aside={<p>aside</p>}
        footer={<p>footer</p>}
      >
        <p>sections</p>
      </ProjectFormLayout>,
    );
    const order = ["alert", "nav", "sections", "aside", "footer"].map((text) =>
      screen.getByText(text),
    );
    for (const [index, node] of order.entries()) {
      const next = order[index + 1];
      if (next)
        expect(node.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it("leaves out the side column when there are no side boxes", () => {
    const { container } = render(
      <ProjectFormLayout nav={<p>nav</p>} footer={<p>footer</p>}>
        <p>sections</p>
      </ProjectFormLayout>,
    );
    expect(container.querySelector("aside")).toBeNull();
  });
});
