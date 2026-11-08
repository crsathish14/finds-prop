import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the admin's listings page shows while the queue is read (S6-T04): its own outline (heading, line, tab row,
 * filters and a few rows) as skeleton blocks, so nothing jumps when the rows arrive. The portal frame around it
 * is already there. The page's `loading.tsx` names it as busy.
 */
export function ListingsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col gap-3">
        <Skeleton shape="title" className="h-9 w-1/2 max-w-xs" />
        <Skeleton shape="text" className="w-full max-w-lg" />
      </div>
      <div className="flex gap-5 border-b border-line-strong pb-4">
        <Skeleton shape="text" className="w-20" />
        <Skeleton shape="text" className="w-24" />
        <Skeleton shape="text" className="w-20" />
        <Skeleton shape="text" className="w-28" />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton shape="row" />
        <Skeleton shape="row" />
        <Skeleton shape="row" />
      </div>
    </div>
  );
}
