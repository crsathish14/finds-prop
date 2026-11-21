import { useTranslations } from "next-intl";
import { FaqSkeleton } from "@/features/faq";

/** The FAQ page's own outline while its questions are read; the site header and footer are already there. */
export default function Loading() {
  const translate = useTranslations("faq");
  return (
    <main id="main" className="flex-1" aria-busy="true" aria-label={translate("loadingTitle")}>
      <FaqSkeleton />
    </main>
  );
}
