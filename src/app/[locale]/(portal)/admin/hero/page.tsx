import type { Metadata } from "next";
import { getTranslate } from "@/features/site";
import { getHeroPage, HeroForm, saveHero, saveSponsors } from "@/features/site-content";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.siteContent.hero.metaTitle") };
}

/**
 * The admin's Hero page (S7-T10, FR-ADM-10, FR-ADM-11): the eyebrow, headline and subtitle and the choice of layout,
 * with a live picture of the hero. It opens on what is saved, read as the signed-in admin and never cached; the role
 * gate in the layout has already sent anyone else away. The form is given a key made from what it opens with, so after
 * a save it starts over from the saved values. The sponsors under it are not part of that key: they save on their own,
 * and a sponsor change must not wipe the hero words being typed.
 */
export default async function HeroPage() {
  const { initial, standard, sponsors } = await getHeroPage();
  return (
    <HeroForm
      key={JSON.stringify(initial)}
      initial={initial}
      standard={standard}
      save={saveHero}
      sponsors={sponsors}
      saveSponsors={saveSponsors}
    />
  );
}
