import { useTranslations } from "next-intl";
import { ProjectsSkeleton } from "@/features/projects";

/** The page's own outline while the projects are read; the site header and footer are already there. */
export default function Loading() {
  const translate = useTranslations("projects.list");
  return (
    <main id="main" className="flex-1" aria-busy="true" aria-label={translate("loadingTitle")}>
      <ProjectsSkeleton />
    </main>
  );
}
