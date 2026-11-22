import type { Metadata } from "next";
import { DisclaimersForm, getDisclaimersPage, saveDisclaimers } from "@/features/site-content";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.siteContent.disclaimers.metaTitle") };
}

/**
 * The admin's Disclaimers page (ADR-152): the plain text shown in the footer of every public page and on the AI search
 * page. It opens on what is saved, read as the signed-in admin and never cached; the role gate in the layout has
 * already sent anyone else away.
 */
export default async function DisclaimersPage() {
  const { initial } = await getDisclaimersPage();
  return <DisclaimersForm key={JSON.stringify(initial)} initial={initial} save={saveDisclaimers} />;
}
