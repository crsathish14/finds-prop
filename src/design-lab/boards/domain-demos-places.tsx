import {
  DeveloperCard,
  DeveloperCardSkeleton,
  type DeveloperCardData,
} from "@/components/domain/developer-card";
import { LocalityTile, LocalityTileSkeleton, tintAt } from "@/components/domain/locality-tile";
import {
  ProjectCard,
  ProjectCardSkeleton,
  type ProjectCardData,
} from "@/components/domain/project-card";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/cn";
import { Specimen } from "../frame";

const PICTURES = "/design-lab/listings";

const ARTWORK = {
  vista: `${PICTURES}/home-a.svg`,
  grove: `${PICTURES}/home-b.svg`,
  residency: `${PICTURES}/home-c.svg`,
};

const PROJECT_FEATURED: ProjectCardData = {
  href: "#project-1",
  name: "Kadal Vista",
  developerName: "Kadal Homes",
  locality: "OMR Navalur",
  city: "Chennai",
  minRupees: 78_00_000,
  maxRupees: 1_42_00_000,
  bedrooms: [2, 3],
  status: "under_construction",
  featured: true,
  cover: { src: ARTWORK.vista, alt: "Drawn placeholder: a house with a pitched roof" },
};

const PROJECT_LAUNCH: ProjectCardData = {
  href: "#project-2",
  name: "Nila Grove",
  developerName: "Nila Habitats",
  locality: "Medavakkam",
  city: "Chennai",
  minRupees: 62_00_000,
  maxRupees: 98_00_000,
  bedrooms: [1, 2],
  status: "new_launch",
  cover: { src: ARTWORK.grove, alt: "Drawn placeholder: a house with a pitched roof" },
};

const PROJECT_READY: ProjectCardData = {
  href: "#project-3",
  name: "Thendral Residency",
  developerName: "Thendral Estates",
  locality: "Porur",
  city: "Chennai",
  minRupees: 88_00_000,
  maxRupees: 1_30_00_000,
  bedrooms: [2, 3],
  status: "ready_to_move",
  cover: { src: ARTWORK.residency, alt: "Drawn placeholder: a house with a pitched roof" },
};

const PROJECT_NO_PICTURE: ProjectCardData = {
  href: "#project-4",
  name: "Arivu Heights",
  developerName: "Arivu Constructions",
  locality: "Velachery",
  city: "Chennai",
  minRupees: 1_10_00_000,
  maxRupees: 1_90_00_000,
  bedrooms: [3, 4],
  status: "under_construction",
  featured: true,
};

const PROJECT_NOTHING_BUT_NAME: ProjectCardData = {
  href: "#project-5",
  name: "Details to follow",
  locality: "Madurai",
  city: "Madurai",
};

const PROJECT_LONG: ProjectCardData = {
  ...PROJECT_FEATURED,
  href: "#project-6",
  name: "Kadal Vista Grand Residences and Club, Phase Two Towers with Sea Views",
  developerName: "Kadal Homes and Infrastructure Private Limited",
  locality: "Thiruvanmiyur Beach Road Extension",
  bedrooms: [1, 2, 3, 4],
};

export function ProjectCardDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Text variant="overline">
          Grid, as on the Projects page and the homepage; hover adds a shadow and a stronger border
        </Text>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {/* Eager, so the full-page screenshots of the board have every picture in them. */}
          <ProjectCard project={PROJECT_FEATURED} priority />
          <ProjectCard project={PROJECT_LAUNCH} priority />
          <ProjectCard project={PROJECT_READY} priority />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Text variant="overline">
          No picture, and a project with nothing but its name and place
        </Text>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <ProjectCard project={PROJECT_NO_PICTURE} />
          <ProjectCard project={PROJECT_NOTHING_BUT_NAME} />
        </div>
      </div>
      <Specimen label="Long name, long developer and long locality (the place truncates, the rest wraps)">
        <div className="w-full max-w-sm">
          <ProjectCard project={PROJECT_LONG} priority />
        </div>
      </Specimen>
      <Specimen label="Loading: the same box, so nothing moves when the data arrives">
        <div className="grid w-full gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
          <ProjectCardSkeleton />
        </div>
      </Specimen>
    </div>
  );
}

const DEVELOPERS: DeveloperCardData[] = [
  {
    name: "Kadal Homes",
    monogram: "KH",
    tint: "green",
    projectCount: 4,
    about: "Mid-rise apartment communities along the OMR corridor.",
    projects: [
      { href: "#project-1", name: "Kadal Vista", cover: ARTWORK.vista },
      { href: "#project-5", name: "Kadal Courts", cover: ARTWORK.grove },
    ],
  },
  {
    name: "Nila Habitats",
    monogram: "NH",
    tint: "copper",
    projectCount: 3,
    about: "Compact homes and plotted layouts in south Chennai.",
    projects: [
      { href: "#project-2", name: "Nila Grove", cover: ARTWORK.grove },
      { href: "#project-6", name: "Nila Meadows", cover: ARTWORK.residency },
    ],
  },
  {
    name: "Thendral Estates",
    monogram: "TE",
    tint: "sand",
    projectCount: 2,
    about: "Ready-to-move apartments in west Chennai.",
    projects: [
      { href: "#project-3", name: "Thendral Residency", cover: ARTWORK.residency },
      { href: "#project-4", name: "Arivu Heights", cover: ARTWORK.vista },
    ],
  },
];

const DEVELOPER_BARE: DeveloperCardData = { name: "Arivu Constructions", projectCount: 1 };

const DEVELOPER_LONG: DeveloperCardData = {
  name: "Sri Venkateswara Constructions and Developers Private Limited",
  projectCount: 12,
  about:
    "Family-run builders of apartments, villas and plotted layouts across Chennai, Chengalpattu and Kanchipuram for more than thirty years, with homes handed over on the promised date.",
  projects: [
    {
      href: "#project-1",
      name: "Sri Venkateswara Gardens Phase Two Towers",
      cover: ARTWORK.vista,
    },
    { href: "#project-2", name: "No picture yet", cover: null },
  ],
};

export function DeveloperCardDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Text variant="overline">As in the Builders section of the homepage</Text>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {DEVELOPERS.map((developer) => (
            <DeveloperCard key={developer.name} developer={developer} />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <Text variant="overline">
          A developer with only a name and a count; and one with long text and a missing picture
        </Text>
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          <DeveloperCard developer={DEVELOPER_BARE} />
          <DeveloperCard developer={DEVELOPER_LONG} />
        </div>
      </div>
      <Specimen label="Loading: the same box, so nothing moves when the data arrives">
        <div className="grid w-full gap-5 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          <DeveloperCardSkeleton />
          <DeveloperCardSkeleton />
          <DeveloperCardSkeleton />
        </div>
      </Specimen>
    </div>
  );
}

const LOCALITIES: { name: string; subtitle: string }[] = [
  { name: "Adyar", subtitle: "Apartments · Villas" },
  { name: "Velachery", subtitle: "Apartments · Plots" },
  { name: "Anna Nagar", subtitle: "Apartments · Commercial" },
  { name: "OMR Sholinganallur", subtitle: "Apartments · New projects" },
  { name: "Porur", subtitle: "Apartments · Plots" },
];

/** The row the homepage shows: two columns on a phone, three on a tablet, five from the portal width. */
const TILE_ROW = "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 portal:grid-cols-5";

export function LocalityTileDemo() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Text variant="overline">
          The five tints in order; hover lifts a tile, Tab reaches each one
        </Text>
        <div className={TILE_ROW}>
          {LOCALITIES.map((locality, index) => (
            <LocalityTile
              key={locality.name}
              name={locality.name}
              subtitle={locality.subtitle}
              href={`#locality-${index + 1}`}
              tint={tintAt(index)}
            />
          ))}
        </div>
      </div>
      <Specimen label="Without a subtitle, and with a long name that wraps">
        <div className="grid w-full max-w-lg grid-cols-2 gap-3">
          <LocalityTile name="Madurai" href="#locality-6" tint={1} />
          <LocalityTile
            name="Thiruvanmiyur Beach Road Extension"
            subtitle="Apartments · Villas"
            href="#locality-7"
            tint={2}
          />
        </div>
      </Specimen>
      <Specimen label="Loading: the same box, so nothing moves when the data arrives">
        <div className={cn(TILE_ROW, "w-full")} aria-busy="true">
          {LOCALITIES.map((locality) => (
            <LocalityTileSkeleton key={locality.name} />
          ))}
        </div>
      </Specimen>
    </div>
  );
}
