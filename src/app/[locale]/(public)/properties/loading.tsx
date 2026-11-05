import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { ResultsSkeleton } from "@/components/domain/results-list";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the results page shows while its address is read and the homes are fetched: the page's own
 * outline (heading, count, bar) as skeleton lines and the grid of loading cards, so nothing jumps
 * when the real page arrives. The site header and footer around it are already there.
 */
export default function Loading() {
  const translate = useTranslations("results");
  return (
    <main id="main" className="flex-1" aria-busy="true" aria-label={translate("loadingTitle")}>
      <Container className="py-6 md:py-8">
        <div aria-hidden="true" className="mb-6 flex flex-col gap-3">
          <Skeleton shape="text" className="hidden w-48 lg:block" />
          <Skeleton shape="title" className="h-9 w-3/4 max-w-xl" />
          <Skeleton shape="text" className="w-56" />
        </div>
        <div className="grid gap-8 lg:grid-cols-[17.5rem_minmax(0,1fr)]">
          <Skeleton shape="card" className="hidden min-h-96 lg:block" />
          <div className="flex min-w-0 flex-col gap-6">
            <div aria-hidden="true" className="flex justify-end">
              <Skeleton className="h-(--size-control) w-52" />
            </div>
            <ResultsSkeleton view="grid" count={6} />
          </div>
        </div>
      </Container>
    </main>
  );
}
