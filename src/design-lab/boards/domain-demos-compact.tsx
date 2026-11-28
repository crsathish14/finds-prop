import { ProjectCard, ProjectCardSkeleton } from "@/components/domain/project-card";
import { PropertyCardSkeleton } from "@/components/domain/property-card";
import { Text } from "@/components/ui/text";
import { Column, Specimen } from "../frame";
import {
  InteractiveCard,
  LONG_TITLE,
  NOTHING_BUT_PRICE,
  PLOT_NO_PICTURE,
  RENT_PRIME,
  SALE_BUDGET,
  SALE_FEATURED,
} from "./domain-demos";
import {
  PROJECT_FEATURED,
  PROJECT_LAUNCH,
  PROJECT_LONG,
  PROJECT_NO_PICTURE,
  PROJECT_NOTHING_BUT_NAME,
  PROJECT_READY,
} from "./domain-demos-places";

/**
 * The compact cards of the AI chat's cards page (ADR-220): the same homes and projects as the results page,
 * as one row about 5.5 rem tall, so six of them fit one screen without scrolling.
 */
export function CompactCardsDemo() {
  return (
    <Column className="max-w-none gap-8">
      <Specimen label="Homes: Featured, Prime, Budget (shows For sale), saved and chosen for compare">
        <div className="flex w-full max-w-md flex-col gap-2">
          <InteractiveCard property={SALE_FEATURED} layout="compact" />
          <InteractiveCard property={RENT_PRIME} layout="compact" startSaved />
          <InteractiveCard property={SALE_BUDGET} layout="compact" startCompared />
        </div>
      </Specimen>
      <Specimen label="Projects: Featured, New launch, Ready to move">
        <div className="flex w-full max-w-md flex-col gap-2">
          {/* Eager, so the full-page screenshots of the board have every picture in them. */}
          <ProjectCard project={PROJECT_FEATURED} layout="compact" priority />
          <ProjectCard project={PROJECT_LAUNCH} layout="compact" priority />
          <ProjectCard project={PROJECT_READY} layout="compact" priority />
        </div>
      </Specimen>
      <Specimen label="No picture, nothing but a price, Compare disabled after three">
        <div className="flex w-full max-w-md flex-col gap-2">
          <InteractiveCard property={PLOT_NO_PICTURE} layout="compact" />
          <InteractiveCard property={NOTHING_BUT_PRICE} layout="compact" compareDisabled />
          <ProjectCard project={PROJECT_NO_PICTURE} layout="compact" />
          <ProjectCard project={PROJECT_NOTHING_BUT_NAME} layout="compact" />
        </div>
      </Specimen>
      <Specimen label="Long text in a phone-width column (the title and the place truncate)">
        <div className="flex w-full max-w-xs flex-col gap-2">
          <InteractiveCard property={LONG_TITLE} layout="compact" />
          <ProjectCard project={PROJECT_LONG} layout="compact" priority />
        </div>
      </Specimen>
      <Specimen label="Loading: the same box, so nothing moves when the cards arrive">
        <div className="flex w-full max-w-md flex-col gap-2" aria-busy="true">
          <PropertyCardSkeleton layout="compact" />
          <ProjectCardSkeleton layout="compact" />
          <PropertyCardSkeleton layout="compact" />
        </div>
      </Specimen>
      <div className="flex flex-col gap-3">
        <Text variant="overline">One cards page: six cards, one screen, no scrolling</Text>
        <div className="flex w-full max-w-md flex-col gap-2">
          <InteractiveCard property={SALE_FEATURED} layout="compact" />
          <ProjectCard project={PROJECT_FEATURED} layout="compact" priority />
          <InteractiveCard property={RENT_PRIME} layout="compact" />
          <ProjectCard project={PROJECT_LAUNCH} layout="compact" priority />
          <InteractiveCard property={SALE_BUDGET} layout="compact" />
          <ProjectCard project={PROJECT_READY} layout="compact" priority />
        </div>
      </div>
    </Column>
  );
}
