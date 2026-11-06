import { useTranslations } from "next-intl";
import { DashboardSkeleton } from "@/features/account";

/** The dashboard's own outline while the person's details are read; the site header and footer are already there. */
export default function Loading() {
  const translate = useTranslations("account.dashboard");
  return (
    <main id="main" className="flex-1" aria-busy="true" aria-label={translate("loadingTitle")}>
      <DashboardSkeleton />
    </main>
  );
}
