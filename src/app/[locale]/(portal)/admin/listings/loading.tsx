import { useTranslations } from "next-intl";
import { ListingsSkeleton } from "@/features/moderation";

/** The listings page's own outline while the queue is read; the portal frame around it is already there. */
export default function Loading() {
  const translate = useTranslations("admin.listings");
  return (
    <div aria-busy="true" aria-label={translate("loadingTitle")}>
      <ListingsSkeleton />
    </div>
  );
}
