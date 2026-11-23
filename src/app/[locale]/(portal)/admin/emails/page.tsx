import type { Metadata } from "next";
import {
  getMailTemplatesEditPage,
  MailTemplatesForm,
  saveMailTemplate,
} from "@/features/mail-templates";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.emails.metaTitle") };
}

/**
 * The admin's Emails page (ADR-183): the wording of the two enquiry mails. It opens on the working copy, else the live
 * wording, else the wording in code, read as the signed-in admin and never cached; the role gate in the layout has
 * already sent anyone else away.
 */
export default async function EmailsPage() {
  const pages = await getMailTemplatesEditPage();
  return <MailTemplatesForm key={JSON.stringify(pages)} pages={pages} save={saveMailTemplate} />;
}
