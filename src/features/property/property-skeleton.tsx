import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { EnquiryCardSkeleton } from "@/components/domain/enquiry-card";
import { PriceCardSkeleton } from "@/components/domain/price-card";
import { PropertyGallerySkeleton } from "@/components/domain/property-gallery";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the property page shows while its home is read: the page's own outline (gallery, title, the
 * facts, a few lines of text, and beside them the price and enquiry cards) as skeleton blocks, so
 * nothing jumps when the real page arrives. Named "Loading property" and busy for a screen reader.
 */
export function PropertySkeleton() {
  const translate = useTranslations("property.page");
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
          <PropertyGallerySkeleton />
          <div className="flex flex-col gap-3">
            <Skeleton shape="title" className="h-9 w-3/4" />
            <Skeleton shape="text" className="w-2/5" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
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
        <div aria-hidden="true" className="hidden flex-col gap-4 lg:flex">
          <PriceCardSkeleton />
          <EnquiryCardSkeleton />
        </div>
      </div>
    </Container>
  );
}
