import { useTranslations } from "next-intl";
import { BlogArticleSkeleton } from "@/features/blog";

/** The article page's own outline while the article is read; the site header and footer are already there. */
export default function Loading() {
  const translate = useTranslations("blog.article");
  return (
    <main id="main" className="flex-1" aria-busy="true" aria-label={translate("loadingTitle")}>
      <BlogArticleSkeleton />
    </main>
  );
}
