import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the contact page shows while its form is read: the heading, the form's card with its fields and the
 * side card, as skeleton blocks, so nothing jumps when the page arrives. The site header and footer around
 * it are already there. The page's `loading.tsx` names it as busy.
 */
export function ContactSkeleton() {
  return (
    <Container className="py-6 md:py-8">
      <div aria-hidden="true" className="mb-6 flex flex-col gap-3">
        <Skeleton shape="title" className="h-9 w-2/3 max-w-xs" />
        <Skeleton shape="text" className="w-full max-w-lg" />
      </div>
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-card lg:col-span-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-40" />
        </div>
        <div className="flex h-fit flex-col gap-4 rounded-xl border border-line bg-surface p-6 shadow-card">
          <Skeleton shape="title" className="h-6 w-1/2" />
          <Skeleton shape="text" className="w-4/5" />
          <Skeleton shape="text" className="w-3/5" />
        </div>
      </div>
    </Container>
  );
}
