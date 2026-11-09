import type { Metadata } from "next";
import { getHeaderPage, HeaderForm, saveHeader } from "@/features/site-content";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.siteContent.header.metaTitle") };
}

/**
 * The admin's Header page (S7-T10, FR-ADM-10): the site name, the navigation links and the call-to-action button, with
 * a live picture of the header. The page opens on what is saved as the signed-in admin (never cached, so an editor
 * always starts from the latest save); the role gate in the layout has already sent anyone else away. The form is
 * given a key made from what it opens with, so after a save it starts over from the saved values.
 */
export default async function HeaderPage() {
  const { initial, standard } = await getHeaderPage();
  return (
    <HeaderForm
      key={JSON.stringify(initial)}
      initial={initial}
      standard={standard}
      save={saveHeader}
    />
  );
}
