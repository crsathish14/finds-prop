import type { Metadata } from "next";
import { getSiteContent, ProjectPrimeForm, saveProjectPrime } from "@/features/site-content";
import { getTranslate } from "@/features/site";
import { PROJECT_PRIME_RULES } from "@/lib/project-prime";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.projectPrime.metaTitle") };
}

/**
 * The super admin's Prime projects page (ADR-208): the amount at which a project counts as Prime, one for each kind of
 * price. It opens on the amounts in use (the saved ones, or the built-in ones until the first save), read as the
 * signed-in admin and never cached; the role gate in the layout has already sent anyone else away.
 */
export default async function PrimeProjectsPage() {
  const { settings } = await getSiteContent();
  const initial = Object.fromEntries(
    PROJECT_PRIME_RULES.map((rule) => [rule, settings.project_prime[rule]?.toString() ?? ""]),
  ) as Record<(typeof PROJECT_PRIME_RULES)[number], string>;
  return (
    <ProjectPrimeForm key={JSON.stringify(initial)} initial={initial} save={saveProjectPrime} />
  );
}
