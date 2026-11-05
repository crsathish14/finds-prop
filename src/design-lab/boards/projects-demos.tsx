"use client";

import { ProjectCard, type ProjectCardData } from "@/components/domain/project-card";
import { ProjectsScreen } from "@/features/projects/projects-screen";
import { ProjectsSkeleton } from "@/features/projects/projects-skeleton";
import { Specimen } from "../frame";

const PICTURES = "/design-lab/listings";

/** Sample projects: the first has everything, the last has no picture and no price. */
const PROJECTS: ProjectCardData[] = [
  {
    href: "#project-1",
    name: "Kadal Vista",
    developerName: "Kadal Homes",
    locality: "OMR Navalur",
    city: "",
    minRupees: 78_00_000,
    maxRupees: 1_42_00_000,
    bedrooms: [2, 3],
    status: "under_construction",
    featured: true,
    cover: { src: `${PICTURES}/home-a.svg`, alt: "Kadal Vista" },
  },
  {
    href: "#project-2",
    name: "Nila Grove",
    developerName: "Nila Habitats",
    locality: "Medavakkam",
    city: "",
    minRupees: 62_00_000,
    maxRupees: 98_00_000,
    bedrooms: [1, 2],
    status: "new_launch",
    cover: { src: `${PICTURES}/home-b.svg`, alt: "Nila Grove" },
  },
  {
    href: "#project-3",
    name: "Olive Residency",
    developerName: "Olive Builders",
    locality: "Porur",
    city: "",
    minRupees: 1_05_00_000,
    maxRupees: 1_05_00_000,
    bedrooms: [3],
    status: "ready_to_move",
    cover: { src: `${PICTURES}/home-c.svg`, alt: "Olive Residency" },
  },
  {
    href: "#project-4",
    name: "Sea Breeze Towers",
    developerName: "Marina Group",
    locality: "Velachery",
    city: "",
    cover: null,
  },
];

const FRAME = "w-full rounded-xl border border-line bg-canvas";

function Screen({
  status = "ok",
  count,
  regionName,
}: {
  status?: "ok" | "failed";
  count: number;
  regionName?: string;
}) {
  return (
    <div className={FRAME}>
      <ProjectsScreen
        status={status}
        titleAs="h2"
        preview
        browseHref="#homes"
        {...(regionName === undefined ? {} : { regionName })}
        cards={PROJECTS.slice(0, count).map((project) => (
          <ProjectCard key={project.href} project={project} />
        ))}
      />
    </div>
  );
}

/** The projects page in its states: with projects, with none, failed to load, and loading. */
export function ProjectsPageDemo() {
  return (
    <div className="flex flex-col gap-14">
      <Specimen
        label="Four projects, with the region from the site content: the last has no picture, price or status"
        className="w-full"
      >
        <Screen count={4} regionName="Chennai" />
      </Specimen>
      <Specimen label="One project, with no region name in the site content" className="w-full">
        <Screen count={1} />
      </Specimen>
      <Specimen label="No projects yet: coming soon, with one way on" className="w-full">
        <Screen count={0} regionName="Chennai" />
      </Specimen>
      <Specimen label="The projects could not be loaded: Try again" className="w-full">
        <Screen status="failed" count={0} regionName="Chennai" />
      </Specimen>
      <Specimen label="Loading" className="w-full">
        <div className={FRAME}>
          <ProjectsSkeleton />
        </div>
      </Specimen>
    </div>
  );
}
