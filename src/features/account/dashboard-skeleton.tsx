import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the dashboard shows while the person's details are read: its own outline (heading, line, tab row
 * and a few rows) as skeleton blocks, so nothing jumps when the page arrives. The site header and
 * footer around it are already there. The page's `loading.tsx` names it as busy.
 */
export function DashboardSkeleton() {
  return (
    <Container className="py-6 md:py-8">
      <div aria-hidden="true" className="mb-6 flex flex-col gap-3">
        <Skeleton shape="title" className="h-9 w-2/3 max-w-xs" />
        <Skeleton shape="text" className="w-full max-w-lg" />
      </div>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex gap-5 border-b border-line-strong pb-4">
          <Skeleton shape="text" className="w-16" />
          <Skeleton shape="text" className="w-24" />
          <Skeleton shape="text" className="w-32" />
          <Skeleton shape="text" className="w-28" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton shape="row" />
          <Skeleton shape="row" />
          <Skeleton shape="row" />
        </div>
      </div>
    </Container>
  );
}
