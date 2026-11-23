import { useTranslations } from "next-intl";
import { CareersListSkeleton } from "@/features/careers";

/** The Careers list's own outline while its jobs are read; the site header and footer are already there. */
export default function Loading() {
  const translate = useTranslations("careers.page");
  return (
    <main id="main" className="flex-1" aria-busy="true" aria-label={translate("loadingTitle")}>
      <CareersListSkeleton />
    </main>
  );
}
