import type { Metadata } from "next";
import { getLegalEditPage, saveLegal } from "@/features/legal";
import { getTranslate } from "@/features/site";
import { LegalForm } from "@/features/site-content";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.siteContent.legal.privacy.metaTitle") };
}

/**
 * The admin's Privacy page (ADR-151): the text of the public Privacy page. It opens on the working copy, else the live
 * text, else the text in code, read as the signed-in admin and never cached; the role gate in the layout has already
 * sent anyone else away.
 */
export default async function PrivacyAdminPage() {
  const { document, hasUnpublishedChanges, published } = await getLegalEditPage("privacy");
  return (
    <LegalForm
      key={JSON.stringify({ document, hasUnpublishedChanges, published })}
      kind="privacy"
      initial={{ document, hasUnpublishedChanges, published }}
      save={saveLegal}
    />
  );
}
