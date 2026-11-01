import { notFound } from "next/navigation";
import { RoutePlaceholder } from "@/app/[locale]/_components/route-placeholder";
import { getFeatureFlags } from "@/features/site";

// AI search is not part of the launch (FLAG_AI_SEARCH). While the flag is off the page does not
// exist, and nothing in the navigation points to it (R-FE-17).
export default function AiSearchPage() {
  if (!getFeatureFlags().aiSearch) notFound();
  return <RoutePlaceholder route="/ai-search" />;
}
