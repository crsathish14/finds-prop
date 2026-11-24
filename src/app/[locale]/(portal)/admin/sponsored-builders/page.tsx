import type { Metadata } from "next";
import { getBuilderOverview } from "@/features/builders";
import { getTranslate } from "@/features/site";
import {
  getSiteContent,
  saveSponsoredBuilders,
  SponsoredBuildersForm,
} from "@/features/site-content";
import { SPONSORED_BUILDERS_MAX } from "@/lib/sponsored-builders";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.sponsoredBuilders.metaTitle") };
}

/**
 * The super admin's Sponsored builders page (ADR-191): which builders and agents the Featured project card and the
 * Developer Spotlight draw from. It opens on what is saved, read as the signed-in admin and never cached; the role gate
 * in the layout has already sent anyone else away. Only active builders and agents can be picked.
 */
export default async function SponsoredBuildersPage() {
  const [{ settings }, { builders }] = await Promise.all([getSiteContent(), getBuilderOverview()]);
  const options = builders
    .filter((builder) => builder.status !== "inactive")
    .map((builder) => ({
      id: builder.id,
      name: builder.name,
      kind: builder.kind,
      projects: builder.projects,
    }));
  const initial = settings.sponsored_builders;
  return (
    <SponsoredBuildersForm
      key={JSON.stringify(initial)}
      options={options}
      initial={initial}
      max={SPONSORED_BUILDERS_MAX}
      save={saveSponsoredBuilders}
    />
  );
}
