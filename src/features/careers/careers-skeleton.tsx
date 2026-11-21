import { JobCardSkeleton } from "@/components/domain/job-card";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the Careers list shows while its jobs are read: the title, the search box, the filters and six cards, as skeleton
 * blocks, so nothing jumps when the page arrives. The page's `loading.tsx` names it as busy.
 */
export function CareersListSkeleton() {
  return (
    <Container className="py-6 md:py-8">
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex max-w-3xl flex-col gap-3">
          <Skeleton shape="title" className="h-9 w-2/3 max-w-sm" />
          <Skeleton shape="text" className="w-full max-w-lg" />
        </div>
        <Skeleton className="h-13 w-full max-w-3xl" />
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((place) => (
            <Skeleton key={place} className="h-13 w-full" />
          ))}
        </div>
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((place) => (
            <li key={place}>
              <JobCardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    </Container>
  );
}

/** What a job page shows while the job is read: the badges, the title, a few facts and a few lines of text. */
export function JobSkeleton() {
  return (
    <Container className="py-6 md:py-8">
      <div aria-hidden="true" className="flex max-w-3xl flex-col gap-6">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-24 rounded-pill" />
          <Skeleton className="h-6 w-16 rounded-pill" />
        </div>
        <Skeleton shape="title" className="h-10 w-full" />
        <Skeleton shape="text" className="w-4/5" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="h-13 w-48" />
        <div className="flex flex-col gap-3">
          <Skeleton shape="text" className="w-full" />
          <Skeleton shape="text" className="w-full" />
          <Skeleton shape="text" className="w-3/5" />
        </div>
      </div>
    </Container>
  );
}
