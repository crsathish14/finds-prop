import { useTranslations } from "next-intl";
import { BlogListSkeleton } from "@/features/blog";

/** The Blog list's own outline while its articles are read; the site header and footer are already there. */
export default function Loading() {
  const translate = useTranslations("blog.page");
  return (
    <main id="main" className="flex-1" aria-busy="true" aria-label={translate("loadingTitle")}>
      <BlogListSkeleton />
    </main>
  );
}
