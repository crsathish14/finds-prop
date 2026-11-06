import { useTranslations } from "next-intl";
import { ContactSkeleton } from "@/features/forms";

/** The contact page's own outline while its form is read; the site header and footer are already there. */
export default function Loading() {
  const translate = useTranslations("contact");
  return (
    <main id="main" className="flex-1" aria-busy="true" aria-label={translate("loadingTitle")}>
      <ContactSkeleton />
    </main>
  );
}
