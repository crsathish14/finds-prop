import type { Metadata } from "next";
import {
  createContentCategory,
  deleteContentCategory,
  getAdminCategories,
  setContentCategoryActive,
  updateContentCategory,
} from "@/features/content-categories";
import { ContentModulePageBar, getContentModulesView } from "@/features/content-modules";
import {
  FaqAdminBoard,
  getAdminFaqs,
  parseAdminFaqParams,
  publishFaq,
  reorderFaqs,
  restoreFaq,
  trashFaq,
  unpublishFaq,
} from "@/features/faq";
import { getTranslate } from "@/features/site";
import { saveContentModules } from "@/features/site-content";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.faq.metaTitle") };
}

/**
 * The admin's FAQ page (ADR-143, FR-ADM-13): the module's switch bar, then the list of questions with its tabs,
 * category filter, search and the buttons of each row, and the categories drawer. The tab, the category and the words are
 * in the address (`?view=`, `?category=`, `?q=`); a value that is not valid is dropped. Everything is read as the
 * signed-in admin (the role gate in the layout has already sent anyone else away) and never cached, so the list is
 * right after every change. The page keeps working while the FAQ module is switched off: the switch only hides it from
 * visitors.
 */
export default async function AdminFaqPage({ searchParams }: PageProps) {
  const params = parseAdminFaqParams(await searchParams);
  const [modules, faqs, trashed, categories] = await Promise.all([
    getContentModulesView(),
    getAdminFaqs({ trashed: false }),
    getAdminFaqs({ trashed: true }),
    getAdminCategories("faq"),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <ContentModulePageBar module="faq" modules={modules} save={saveContentModules} />
      <FaqAdminBoard
        key={`${params.view}|${params.category}`}
        faqs={faqs}
        trashed={trashed}
        categories={categories}
        params={params}
        actions={{
          publish: publishFaq,
          unpublish: unpublishFaq,
          trash: trashFaq,
          restore: restoreFaq,
          reorder: reorderFaqs,
        }}
        categoryActions={{
          create: createContentCategory,
          update: updateContentCategory,
          setActive: setContentCategoryActive,
          remove: deleteContentCategory,
        }}
      />
    </div>
  );
}
