import type { Metadata } from "next";
import { getTranslate } from "@/features/site";
import { getHomepagePage, HomepageForm, saveHomepage } from "@/features/site-content";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.siteContent.homepage.metaTitle") };
}

/**
 * The admin's Homepage page (S7-T10, FR-ADM-10, ADD-11): the switch of each section below the hero and the list of
 * curated localities, with a live picture of the home page. It opens on what is saved, read as the signed-in admin and
 * never cached; the role gate in the layout has already sent anyone else away.
 */
export default async function HomepagePage() {
  const { initial } = await getHomepagePage();
  return <HomepageForm key={JSON.stringify(initial)} initial={initial} save={saveHomepage} />;
}
