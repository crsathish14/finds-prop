import { useTranslations } from "next-intl";
import { PropertyGallerySkeleton } from "@/components/domain/property-gallery";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the project page shows while its project is read: the page's own outline (gallery, developer,
 * title, the facts, a few lines of text, and beside them the price card) as skeleton blocks, so nothing
 * jumps when the real page arrives. Named "Loading project" and busy for a screen reader.
 */
export function ProjectSkeleton() {
  const translate = useTranslations("projects.page");
  return (
    <Container
      as="div"
      aria-busy="true"
      aria-label={translate("loading")}
      role="status"
      className="py-6 md:py-8"
    >
      <div aria-hidden="true" className="mb-4 hidden lg:block">
        <Skeleton shape="text" className="w-64" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_var(--w-detail-aside)] lg:gap-10">
        <div aria-hidden="true" className="flex min-w-0 flex-col gap-8">
          <div className="flex flex-col gap-3">
            <Skeleton shape="text" className="w-32" />
            <Skeleton shape="title" className="h-9 w-3/4" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-28 rounded-pill" />
              <Skeleton className="h-6 w-40 rounded-pill" />
            </div>
          </div>
          <PropertyGallerySkeleton />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton shape="text" className="w-11/12" />
            <Skeleton shape="text" className="w-10/12" />
            <Skeleton shape="text" className="w-7/12" />
          </div>
        </div>
        <div aria-hidden="true" className="flex flex-col gap-4">
          <Skeleton shape="card" className="h-32 w-full" />
        </div>
      </div>
    </Container>
  );
}
