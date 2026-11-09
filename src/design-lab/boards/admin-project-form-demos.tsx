"use client";

import { useState, type ReactNode } from "react";
import {
  ProjectFields,
  type ProjectFieldName,
  type ProjectFieldValues,
  type ProjectFieldsWords,
} from "@/components/domain/project-fields";
import { ProjectFormLayout } from "@/components/domain/project-form-layout";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import {
  ProjectSectionNav,
  type ProjectSectionId,
  type ProjectSectionItem,
  type ProjectSectionState,
} from "@/components/domain/project-section-nav";
import { Alert } from "@/components/patterns/alert";
import { TagListField, type TagListWords } from "@/components/patterns/tag-list-field";
import { NativeSelect } from "@/components/ui/native-select";
import { Specimen } from "../frame";

/**
 * The project form's parts in their states (S7-T02, part B1): the section list, the sections (Basics, Location, RERA,
 * Details, SEO), the tag list, the save bar and the frame that holds them, for the admin and for a builder. Plain
 * English text; nothing here goes anywhere. The media section and the price trends come with part B2. The words that
 * are not in the approved UX file are listed in ADR-087 for the owner to confirm.
 */

const TAG_WORDS: TagListWords = {
  placeholder: "Add another and press Enter",
  add: "Add",
  remove: "Remove",
  suggestions: "Suggestions",
  full: "The list is full.",
};

const WORDS: ProjectFieldsWords = {
  basics: { title: "Basics", description: "The essentials buyers see first." },
  location: { title: "Location", description: "Where the project is and what is nearby." },
  rera: { title: "RERA", description: "Registration details for this project." },
  details: { title: "Details", description: "Description, specifications and amenities." },
  media: {
    title: "Media",
    description: "Images, floor plans, elevations and the brochure.",
  },
  seo: { title: "SEO", description: "How the project appears in search engines." },
  name: "Project name",
  builder: "Builder",
  builderHint: "Only admins can assign a project to a builder.",
  unset: "Not set",
  projectType: "Project type",
  propertyType: "Property type",
  projectStatus: "Status",
  priceMin: "Price from (₹)",
  priceMax: "Price to (₹)",
  bhk: "BHK options",
  landArea: "Land area (acres)",
  totalUnits: "Total units",
  possession: "Possession",
  contactPhone: "Contact phone",
  locality: "Locality",
  address: "Address",
  latitude: "Latitude",
  longitude: "Longitude",
  advantages: "Location advantages",
  nearby: "Nearby places",
  reraApplicable: "RERA applicable",
  reraNumber: "RERA number",
  description: "Description",
  specifications: "Specifications",
  amenities: "Amenities",
  seoTitle: "Page title",
  slug: "Slug",
  slugHint: "Page address: /projects/",
  slugLockedHint: "The page address cannot be changed once the project is approved.",
  seoDescription: "Meta description",
  optional: "(optional)",
  tags: TAG_WORDS,
};

const OPTIONS = {
  builders: [
    { value: "b1", label: "Kadal Homes" },
    { value: "b2", label: "Nila Habitats" },
    { value: "b3", label: "Thendral Estates" },
  ],
  projectTypes: [
    { value: "residential", label: "Residential" },
    { value: "commercial", label: "Commercial" },
    { value: "plotted_layout", label: "Plotted layout" },
  ],
  propertyTypes: [
    { value: "apartment", label: "Apartment" },
    { value: "villa", label: "Villa" },
  ],
  statuses: [
    { value: "new_launch", label: "New launch" },
    { value: "under_construction", label: "Under construction" },
    { value: "ready_to_move", label: "Ready to move" },
  ],
};

const BUILDER_OPTIONS = {
  projectTypes: OPTIONS.projectTypes,
  propertyTypes: OPTIONS.propertyTypes,
  statuses: OPTIONS.statuses,
};

const SUGGESTIONS = ["Clubhouse", "Swimming pool", "Gym", "24x7 security", "Power backup", "Lift"];

const EMPTY: ProjectFieldValues = {
  name: "",
  builderId: "",
  projectType: "",
  propertyType: "",
  projectStatus: "",
  priceMin: "",
  priceMax: "",
  bhkOptions: [],
  landAreaAcres: "",
  totalUnits: "",
  possessionDate: "",
  contactPhone: "",
  locality: "",
  address: "",
  latitude: "",
  longitude: "",
  advantages: [],
  nearby: [],
  reraApplicable: true,
  reraNumber: "",
  description: "",
  specifications: "",
  amenities: [],
  seoTitle: "",
  slug: "",
  seoDescription: "",
};

const FILLED: ProjectFieldValues = {
  name: "Kadal Vista",
  builderId: "b1",
  projectType: "residential",
  propertyType: "apartment",
  projectStatus: "under_construction",
  priceMin: "78,00,000",
  priceMax: "1,42,00,000",
  bhkOptions: [2, 3],
  landAreaAcres: "4.2",
  totalUnits: "320",
  possessionDate: "2028-12-31",
  contactPhone: "+91 90000 00000",
  locality: "OMR Navalur",
  address: "Rajiv Gandhi Salai, Navalur",
  latitude: "12.8451",
  longitude: "80.2262",
  advantages: ["5 min to the IT corridor", "Near the beach road"],
  nearby: ["Navalur junction"],
  reraApplicable: true,
  reraNumber: "TN/SAMPLE/0000",
  description: "A gated community of mid-rise towers around landscaped courtyards.",
  specifications: "RCC framed structure. Vitrified tiles in living areas.",
  amenities: ["Clubhouse", "Swimming pool", "Gym"],
  seoTitle: "Kadal Vista, 2 and 3 BHK homes in OMR Navalur",
  slug: "kadal-vista",
  seoDescription: "Gated homes with a clubhouse and pool, a few minutes from the IT corridor.",
};

const NAV_WORDS = { nav: "Form sections", done: "Complete", error: "Needs attention" };

const SECTION_LABELS: [ProjectSectionId, string][] = [
  ["basics", "Basics"],
  ["location", "Location"],
  ["rera", "RERA"],
  ["details", "Details"],
  ["media", "Media"],
  ["seo", "SEO"],
];

function sections(states: Partial<Record<ProjectSectionId, ProjectSectionState>>) {
  return SECTION_LABELS.map(([id, label]): ProjectSectionItem => ({
    id,
    label,
    state: states[id] ?? "idle",
  }));
}

/** A list of sections to try: the choice moves the current section; the link also jumps to the anchor on the page. */
function NavDemoState({
  states,
  first = "basics",
}: {
  states: Partial<Record<ProjectSectionId, ProjectSectionState>>;
  first?: ProjectSectionId;
}) {
  const [current, setCurrent] = useState<ProjectSectionId>(first);
  return (
    <div className="w-full max-w-205 portal:max-w-48">
      <ProjectSectionNav
        sections={sections(states)}
        current={current}
        words={NAV_WORDS}
        onSelect={setCurrent}
      />
    </div>
  );
}

function SideBox({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 md:p-6">
      <h2 className="text-title font-bold text-ink">{title}</h2>
      <p className="text-small text-muted">{text}</p>
      {children}
    </div>
  );
}

type FormProps = {
  initial: ProjectFieldValues;
  builder?: boolean;
  slugLocked?: boolean;
  errors?: Partial<Record<ProjectFieldName, string>>;
  states: Partial<Record<ProjectSectionId, ProjectSectionState>>;
  top?: ReactNode;
  note: string;
  saving?: boolean;
};

/** The whole form as a page would put it together. */
function LiveForm({
  initial,
  builder = false,
  slugLocked = false,
  errors,
  states,
  top,
  note,
  saving = false,
}: FormProps) {
  const [values, setValues] = useState(initial);
  const [current, setCurrent] = useState<ProjectSectionId>("basics");
  const [formId, setFormId] = useState("");
  return (
    <div className="w-full">
      <ProjectFormLayout
        {...(top ? { top } : {})}
        nav={
          <ProjectSectionNav
            sections={sections(states).filter((section) => section.id !== "media")}
            current={current}
            words={NAV_WORDS}
            onSelect={setCurrent}
          />
        }
        {...(builder
          ? {}
          : {
              aside: (
                <SideBox
                  title="Enquiry form"
                  text="Which form buyers see on the project page. If none is chosen, the standard enquiry form is used."
                >
                  <NativeSelect
                    aria-label="Enquiry form"
                    value={formId}
                    onChange={(event) => setFormId(event.target.value)}
                  >
                    <option value="">Standard enquiry form</option>
                    <option value="f1">Kadal Vista site-visit form</option>
                  </NativeSelect>
                </SideBox>
              ),
            })}
        footer={
          <ProjectSaveBar
            note={note}
            words={{ cancel: "Cancel", save: "Save project", saving: "Saving" }}
            saving={saving}
            sticky={false}
            onCancel={() => undefined}
          />
        }
      >
        <ProjectFields
          values={values}
          {...(errors ? { errors } : {})}
          onChange={(name, value) => setValues((now) => ({ ...now, [name]: value }))}
          options={builder ? BUILDER_OPTIONS : OPTIONS}
          amenitySuggestions={SUGGESTIONS}
          slugLocked={slugLocked}
          disabled={saving}
          words={WORDS}
        />
      </ProjectFormLayout>
    </div>
  );
}

export function ProjectFormDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="The admin's form: filled, with the Enquiry form box (try the section list, the lists, the RERA switch)">
        <LiveForm
          initial={FILLED}
          states={{ basics: "done", location: "done", rera: "done", details: "done", seo: "done" }}
          note="Admins can save without re-approval."
        />
      </Specimen>
      <Specimen label="A new project: empty, saved with the name, the locality and the page address missing; the alert lists them and the section list marks where">
        <LiveForm
          initial={EMPTY}
          states={{ basics: "error", location: "error", seo: "error" }}
          errors={{
            name: "Enter the project name.",
            builderId: "Choose the builder.",
            locality: "Enter the locality.",
            slug: "Use lower case letters, numbers and single hyphens, from 2 to 80 characters.",
          }}
          top={
            <Alert tone="danger" title="3 things need attention">
              Add the project name, the locality and the page address before saving.
            </Alert>
          }
          note="Admins can save without re-approval."
        />
      </Specimen>
      <Specimen label="A builder's form: the approval warning on top, no Builder box and no Enquiry form box, the page address of an approved project locked">
        <LiveForm
          initial={FILLED}
          builder
          slugLocked
          states={{ basics: "done", location: "done", rera: "done", details: "done", seo: "done" }}
          top={
            <Alert tone="warning" title="Saving sends this project for approval">
              It is set to Pending and hidden from the public site until it is approved again.
            </Alert>
          }
          note="Saving sends this project for approval."
        />
      </Specimen>
      <Specimen label="Saving: every box is off and Save says Saving">
        <LiveForm
          initial={FILLED}
          saving
          states={{ basics: "done", location: "done", rera: "done", details: "done", seo: "done" }}
          note="Admins can save without re-approval."
        />
      </Specimen>
    </div>
  );
}

export function ProjectSectionNavDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Nothing done yet, Basics current (a row that scrolls sideways below 1100 px, a column from 1100 px of screen)">
        <NavDemoState states={{}} />
      </Specimen>
      <Specimen label="Some sections done, Location current">
        <NavDemoState
          first="location"
          states={{ basics: "done", location: "done", rera: "done" }}
        />
      </Specimen>
      <Specimen label="Two sections need attention">
        <NavDemoState first="seo" states={{ basics: "error", details: "done", seo: "error" }} />
      </Specimen>
    </div>
  );
}

function TagsDemoState({
  initial,
  max,
  suggestions,
  error,
  disabled,
  label,
  hint,
}: {
  initial: string[];
  max: number;
  suggestions?: string[];
  error?: string;
  disabled?: boolean;
  label: string;
  hint?: string;
}) {
  const [tags, setTags] = useState(initial);
  return (
    <div className="w-full max-w-135 rounded-xl border border-line bg-surface p-6">
      <TagListField
        label={label}
        tags={tags}
        onChange={setTags}
        max={max}
        {...(suggestions ? { suggestions } : {})}
        {...(error ? { error } : {})}
        {...(hint ? { hint } : {})}
        {...(disabled ? { disabled } : {})}
        words={TAG_WORDS}
      />
    </div>
  );
}

export function TagListFieldDemo() {
  return (
    <div className="flex flex-col gap-10">
      <Specimen label="Empty, with suggestions (type and press Enter or Add; tap a suggestion)">
        <TagsDemoState label="Amenities" initial={[]} max={30} suggestions={SUGGESTIONS} />
      </Specimen>
      <Specimen label="Some added; a hint; a very long phrase wraps inside its chip">
        <TagsDemoState
          label="Location advantages"
          hint="Short phrases buyers look for, such as the distance to a landmark."
          initial={[
            "5 min to the IT corridor",
            "Near the beach road",
            "Ten minutes from the international airport by the new expressway with a dedicated lane",
          ]}
          max={20}
        />
      </Specimen>
      <Specimen label="Full (3 of 3): the box is off and the list says so; the x still removes">
        <TagsDemoState
          label="Nearby places"
          initial={["Navalur junction", "Metro station", "Tech park"]}
          max={3}
          suggestions={SUGGESTIONS}
        />
      </Specimen>
      <Specimen label="With an error">
        <TagsDemoState
          label="Amenities"
          initial={["Clubhouse"]}
          max={30}
          error="Add no more than 30 amenities."
        />
      </Specimen>
      <Specimen label="Off while saving">
        <TagsDemoState
          label="Amenities"
          initial={["Clubhouse", "Gym"]}
          max={30}
          suggestions={SUGGESTIONS}
          disabled
        />
      </Specimen>
    </div>
  );
}
