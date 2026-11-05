"use client";

import { ProjectNotFound } from "@/features/projects/project-not-found";
import { ProjectScreen } from "@/features/projects/project-screen";
import { ProjectSkeleton } from "@/features/projects/project-skeleton";
import type { ProjectData, ProjectUnit } from "@/features/projects/types";
import { Specimen } from "../frame";

const PICTURES = "/design-lab/listings";
const FRAME = "w-full rounded-xl border border-line bg-canvas";

const UNITS: ProjectUnit[] = [
  ["A-101", 1, 2, 1050, "East", 78_00_000, "available"],
  ["A-102", 1, 3, 1450, "North", 1_12_00_000, "hold"],
  ["A-201", 2, 2, 1060, "East", 80_00_000, "sold"],
  ["A-202", 2, 3, 1460, "North", 1_14_00_000, "available"],
  ["B-301", 3, 3, 1480, "West", 1_18_00_000, "available"],
  ["B-302", 3, 2, 1075, "South", 84_00_000, "blocked"],
].map(([number, floor, bhk, areaSqft, facing, price, status]) => ({
  number: number as string,
  floor: floor as number,
  bhk: bhk as number,
  areaSqft: areaSqft as number,
  facing: facing as string,
  price: price as number,
  status: status as ProjectUnit["status"],
  floorPlanPath: null,
}));

const TREND = [7650, 7720, 7810, 7900, 8020, 8110, 8230, 8350].map((pricePerSqft, index) => ({
  month: `2026-${String(index + 3).padStart(2, "0")}-01`,
  pricePerSqft,
}));

/** A project with everything the page can show. */
const FULL: ProjectData = {
  id: "00000000-0000-4000-8000-000000000001",
  slug: "kadal-vista",
  name: "Kadal Vista",
  developer: { id: "b1", name: "Kadal Homes" },
  status: "under_construction",
  priceMin: 78_00_000,
  priceMax: 1_42_00_000,
  bhkOptions: [2, 3],
  landAreaAcres: 4.2,
  totalUnits: 320,
  possessionDate: "2028-12-31",
  contactPhone: "+914412345678",
  locality: "OMR Navalur",
  advantages: ["5 min to the IT corridor", "Near the beach road", "Schools within 2 km"],
  nearby: ["Navalur junction", "Shopping mall", "Hospital"],
  reraApplicable: true,
  reraNumber: "TN/SAMPLE/0000",
  description:
    "Kadal Vista is a gated community of mid-rise towers around landscaped courtyards on the OMR corridor. This is sample copy: the real description comes from the developer's project record.",
  specifications:
    "Structure: RCC framed structure\nFlooring: Vitrified tiles in living areas\nKitchen: Granite counter with provision for modular fittings\nDoors: Teak frame main door, flush internal doors",
  amenities: [
    "Clubhouse",
    "Swimming Pool",
    "Gym",
    "Children Play Area",
    "24x7 Security",
    "Power Backup",
    "Car Park",
  ],
  images: ["a", "b", "c", "a", "b", "c"],
  floorPlans: ["plan-1", "plan-2", "plan-3"],
  videos: ["https://example.com/walkthrough", "https://example.com/amenities"],
  brochurePath: "brochure.pdf",
  seoTitle: null,
  seoDescription: null,
  featured: true,
  units: UNITS,
  unitCount: 320,
  availableCount: 184,
  trend: TREND,
};

/** A project the developer has told us little about: the page leaves the empty sections out. */
const SPARSE: ProjectData = {
  ...FULL,
  name: "Sea Breeze Towers",
  slug: "sea-breeze-towers",
  developer: { id: "b2", name: "Marina Group" },
  status: null,
  priceMin: 1_05_00_000,
  priceMax: 1_05_00_000,
  bhkOptions: [3],
  landAreaAcres: null,
  totalUnits: null,
  possessionDate: null,
  contactPhone: "4412345678",
  locality: "Velachery",
  advantages: [],
  nearby: [],
  reraApplicable: false,
  reraNumber: null,
  description: null,
  specifications: null,
  amenities: [],
  images: [],
  floorPlans: [],
  videos: [],
  brochurePath: null,
  featured: false,
  units: [],
  unitCount: 0,
  availableCount: 0,
  trend: [],
};

const pictureOf = (path: string) => {
  const letter = path.at(0);
  const file = letter === "b" ? "home-b" : letter === "c" ? "home-c" : "home-a";
  return `${PICTURES}/${file}.svg`;
};

function Screen({ project, brochure }: { project: ProjectData; brochure: boolean }) {
  return (
    <div className={FRAME}>
      <ProjectScreen
        project={project}
        titleAs="h2"
        imageSources={project.images.map(pictureOf)}
        floorPlanSources={project.floorPlans.map(() => `${PICTURES}/home-a.svg`)}
        brochureSource={brochure ? "https://example.com/brochure.pdf" : null}
      />
    </div>
  );
}

/** The project page with everything, with little given, not found and loading. */
export function ProjectPageDemo() {
  return (
    <div className="flex flex-col gap-14">
      <Specimen
        label="A project with everything: gallery, overview, about, amenities, specifications, units, floor plans, price trend, location and videos"
        className="w-full"
      >
        <Screen project={FULL} brochure />
      </Specimen>
      <Specimen
        label="A project with little given: one price, no picture, no RERA, no units or trend; the empty sections are left out"
        className="w-full"
      >
        <Screen project={SPARSE} brochure={false} />
      </Specimen>
      <Specimen label="Project not found" className="w-full">
        <div className={FRAME}>
          <ProjectNotFound titleAs="h2" />
        </div>
      </Specimen>
      <Specimen label="Loading" className="w-full">
        <div className={FRAME}>
          <ProjectSkeleton />
        </div>
      </Specimen>
    </div>
  );
}
