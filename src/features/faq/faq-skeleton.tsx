import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the FAQ page shows while its questions are read: the title, the search box, the chips and two cards of
 * questions, as skeleton blocks, so nothing jumps when the page arrives. The page's `loading.tsx` names it as busy.
 */
export function FaqSkeleton() {
  return (
    <Container className="py-6 md:py-8">
      <div aria-hidden="true" className="flex max-w-3xl flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Skeleton shape="title" className="h-9 w-2/3 max-w-sm" />
          <Skeleton shape="text" className="w-full max-w-lg" />
        </div>
        <Skeleton className="h-13 w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-16 rounded-pill" />
          <Skeleton className="h-10 w-24 rounded-pill" />
          <Skeleton className="h-10 w-24 rounded-pill" />
        </div>
        {[0, 1].map((group) => (
          <div key={group} className="flex flex-col gap-3">
            <Skeleton shape="title" className="h-7 w-40" />
            <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6">
              <Skeleton shape="text" className="w-4/5" />
              <Skeleton shape="text" className="w-3/5" />
              <Skeleton shape="text" className="w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  );
}
