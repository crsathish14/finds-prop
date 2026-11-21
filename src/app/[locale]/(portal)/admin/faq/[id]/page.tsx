import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminCategories } from "@/features/content-categories";
import { createFaq, FaqEditor, getAdminFaq, updateFaq } from "@/features/faq";
import { getTranslate } from "@/features/site";

type PageProps = { params: Promise<{ id: string }> };

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.faq.metaTitleEdit") };
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The admin's edit question page (ADR-143): the form filled with what is stored. An address that is not a question id,
 * a question that does not exist, or one in the Trash (restore it from the list first) is "not found". Read as the
 * signed-in admin and never cached, so the form opens with what is stored.
 */
export default async function EditFaqPage({ params }: PageProps) {
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const [faq, categories, translate] = await Promise.all([
    getAdminFaq(id.toLowerCase()),
    getAdminCategories("faq"),
    getTranslate(),
  ]);
  if (!faq || faq.deletedAt !== null) notFound();
  return (
    <FaqEditor
      faq={faq}
      categories={categories.map((category) => ({
        value: category.id,
        label: category.active
          ? category.name
          : translate("admin.faq.category.hidden", { name: category.name }),
      }))}
      actions={{ create: createFaq, update: updateFaq }}
    />
  );
}
