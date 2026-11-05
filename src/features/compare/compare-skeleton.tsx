import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The comparison while its homes are read: the heading and a table-shaped block, so nothing jumps when
 * the table arrives. Named "Loading comparison" and busy for a screen reader.
 */
export function CompareSkeleton() {
  const translate = useTranslations("compare");
  return (
    <Container
      aria-busy="true"
      aria-label={translate("loading")}
      role="status"
      className="py-6 md:py-8"
    >
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Skeleton shape="text" className="hidden w-56 lg:block" />
          <Skeleton shape="title" className="h-9 w-2/3 max-w-md" />
          <Skeleton shape="text" className="w-3/4 max-w-lg" />
        </div>
        <Skeleton shape="card" className="min-h-96" />
      </div>
    </Container>
  );
}
