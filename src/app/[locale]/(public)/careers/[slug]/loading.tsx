import { useTranslations } from "next-intl";
import { JobSkeleton } from "@/features/careers";

/** The job page's own outline while the job is read; the site header and footer are already there. */
export default function Loading() {
  const translate = useTranslations("careers.page");
  return (
    <main id="main" className="flex-1" aria-busy="true" aria-label={translate("jobLoadingTitle")}>
      <JobSkeleton />
    </main>
  );
}
