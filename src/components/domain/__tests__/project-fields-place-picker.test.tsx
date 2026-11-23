// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PlacePickerFieldProps } from "../place-picker";
import { ProjectFields, type ProjectFieldValues, type ProjectFieldsWords } from "../project-fields";

const WORDS: ProjectFieldsWords = {
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
  tags: {
    placeholder: "Add another",
    add: "Add",
    remove: "Remove",
    suggestions: "Suggestions",
    full: "The list is full.",
  },
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
  address: "Old Mahabalipuram Road",
  latitude: "",
  longitude: "",
  advantages: [],
  nearby: [],
  reraApplicable: false,
  reraNumber: "",
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

/** A stand-in for the page's place picker: one button that reports a fixed place, so no network is involved. */
function FakePicker({ id, disabled, onPick }: PlacePickerFieldProps) {
  return (
    <span id={id}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onPick({ label: "Navalur", lat: 12.84701234, lng: 80.2271 })}
      >
        Pick place
      </button>
    </span>
  );
}

/** The same, for a place whose address names a city. */
function FakeCityPicker({ id, onPick }: PlacePickerFieldProps) {
  return (
    <span id={id}>
      <button
        type="button"
        onClick={() => onPick({ label: "Kadaikulam", lat: 9.9252, lng: 78.1198, city: "Madurai" })}
      >
        Pick city place
      </button>
    </span>
  );
}

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
      words={WORDS}
      {...props}
    />
  );
}

describe("UT-project-fields with a place picker (ADR-140)", () => {
  it("has no picker unless the page gives one", () => {
    render(<Live />);
    expect(screen.queryByRole("button", { name: "Pick place" })).toBeNull();
  });

  it("draws the picker in the Location section and writes the two boxes when a place is chosen", async () => {
    const spy = vi.fn();
    render(<Live spy={spy} placePicker={FakePicker} />);
    const location = screen.getByRole("region", { name: "Location" });
    await userEvent.click(within(location).getByRole("button", { name: "Pick place" }));
    expect(spy).toHaveBeenCalledWith("latitude", "12.847012");
    expect(spy).toHaveBeenCalledWith("longitude", "80.2271");
    expect(screen.getByLabelText(/Latitude/)).toHaveValue("12.847012");
    expect(screen.getByLabelText(/Longitude/)).toHaveValue("80.2271");
    // Only the point is written: the locality and the address the admin typed are left alone.
    expect(spy).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText(/Locality/)).toHaveValue("OMR");
    expect(screen.getByLabelText(/Address/)).toHaveValue("Old Mahabalipuram Road");
  });

  it("writes the city too when the chosen place names one", async () => {
    const spy = vi.fn();
    render(<Live spy={spy} placePicker={FakeCityPicker} />);
    await userEvent.click(screen.getByRole("button", { name: "Pick city place" }));
    expect(spy).toHaveBeenCalledWith("city", "Madurai");
    expect(screen.getByLabelText(/City/)).toHaveValue("Madurai");
    expect(screen.getByLabelText(/Locality/)).toHaveValue("OMR");
  });

  it("leaves the typed boxes working after a pick", async () => {
    render(<Live placePicker={FakePicker} />);
    await userEvent.click(screen.getByRole("button", { name: "Pick place" }));
    const latitude = screen.getByLabelText(/Latitude/);
    await userEvent.clear(latitude);
    await userEvent.type(latitude, "12.9");
    expect(latitude).toHaveValue("12.9");
    expect(screen.getByLabelText(/Longitude/)).toHaveValue("80.2271");
  });

  it("switches the picker off while saving", () => {
    render(<Live placePicker={FakePicker} disabled />);
    expect(screen.getByRole("button", { name: "Pick place" })).toBeDisabled();
  });
});
