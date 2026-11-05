import { ProjectCardSkeleton } from "@/components/domain/project-card";
import { SectionGrid } from "@/components/domain/section-grid";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the projects page shows while the projects are read: its own outline (breadcrumb, heading and
 * line) as skeleton lines and three loading cards, so nothing jumps when the real page arrives. The
 * site header and footer around it are already there. The page's `loading.tsx` names it as busy.
 */
export function ProjectsSkeleton() {
  return (
    <Container className="py-6 md:py-8">
      <div aria-hidden="true" className="mb-6 flex flex-col gap-3">
        <Skeleton shape="text" className="hidden w-48 lg:block" />
        <Skeleton shape="text" className="w-24" />
        <Skeleton shape="title" className="h-9 w-3/4 max-w-xl" />
        <Skeleton shape="text" className="w-full max-w-lg" />
      </div>
      <SectionGrid variant="cards">
        <ProjectCardSkeleton />
        <ProjectCardSkeleton />
        <ProjectCardSkeleton className="hidden portal:flex" />
      </SectionGrid>
    </Container>
  );
}
