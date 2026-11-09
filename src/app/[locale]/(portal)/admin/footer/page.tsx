import type { Metadata } from "next";
import { getFooterPage, FooterForm, saveFooter } from "@/features/site-content";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.siteContent.footer.metaTitle") };
}

/**
 * The admin's Footer page (S7-T10, FR-ADM-10): the about text, the contact details, the links and the copyright line,
 * with a live picture of the footer. It opens on what is saved, read as the signed-in admin and never cached; the
 * role gate in the layout has already sent anyone else away.
 */
export default async function FooterPage() {
  const { initial, standard } = await getFooterPage();
  return (
    <FooterForm
      key={JSON.stringify(initial)}
      initial={initial}
      standard={standard}
      save={saveFooter}
    />
  );
}
