import type { Metadata } from "next";
import { getAdminCategories } from "@/features/content-categories";
import { createFaq, FaqEditor, updateFaq } from "@/features/faq";
import { getTranslate } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.faq.metaTitleNew") };
}

/**
 * The admin's new question page (ADR-143): the question form, in the category the list was narrowed to when it is one
 * of ours. A new question is a draft until the admin publishes it. The categories are read as the signed-in admin.
 */
export default async function NewFaqPage({ searchParams }: PageProps) {
  const [raw, translate, categories] = await Promise.all([
    searchParams,
    getTranslate(),
    getAdminCategories("faq"),
  ]);
  const asked = Array.isArray(raw.category) ? raw.category[0] : raw.category;
  return (
    <FaqEditor
      faq={null}
      categories={categories.map((category) => ({
        value: category.id,
        label: category.active
          ? category.name
          : translate("admin.faq.category.hidden", { name: category.name }),
      }))}
      {...(asked && categories.some((category) => category.id === asked)
        ? { initialCategory: asked }
        : {})}
      actions={{ create: createFaq, update: updateFaq }}
    />
  );
}
