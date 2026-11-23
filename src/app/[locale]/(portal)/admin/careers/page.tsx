import type { Metadata } from "next";
import {
  CareersAdminBoard,
  closeJobPosting,
  getAdminJobCounts,
  getAdminJobList,
  getJobDepartmentUsage,
  openJobPosting,
  parseAdminJobParams,
  restoreJobPosting,
  trashJobPosting,
} from "@/features/careers";
import {
  createContentCategory,
  deleteContentCategory,
  getAdminCategories,
  setContentCategoryActive,
  updateContentCategory,
} from "@/features/content-categories";
import { ContentModulePageBar, getContentModulesView } from "@/features/content-modules";
import { getTranslate } from "@/features/site";
import { saveContentModules } from "@/features/site-content";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.careers.metaTitle") };
}

/**
 * The admin's Careers page (ADR-143, FR-ADM-15): the module's switch bar, then the list of jobs with its status tabs,
 * department filter, search, page links and the buttons of each row, and the departments drawer. The tab, department,
 * words and page are in the address (`?status=`, `?department=`, `?q=`, `?page=`); a value that is not valid is
 * dropped. Everything is read as the signed-in admin (the role gate in the layout has already sent anyone else away)
 * and never cached, so the list is right after every change. The page keeps working while the Careers module is
 * switched off: the switch only hides it from visitors.
 */
export default async function AdminCareersPage({ searchParams }: PageProps) {
  const params = parseAdminJobParams(await searchParams);
  const [modules, list, counts, departments, usage] = await Promise.all([
    getContentModulesView(),
    getAdminJobList({
      status: params.status === "all" ? null : params.status,
      departmentId: params.department === "" ? null : params.department,
      query: params.query,
      page: params.page,
    }),
    getAdminJobCounts(),
    getAdminCategories("department"),
    getJobDepartmentUsage(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <ContentModulePageBar module="careers" modules={modules} save={saveContentModules} />
      <CareersAdminBoard
        rows={list.rows}
        total={list.total}
        page={list.page}
        pageCount={list.pageCount}
        counts={counts}
        departments={departments}
        usage={usage}
        params={params}
        actions={{
          open: openJobPosting,
          close: closeJobPosting,
          trash: trashJobPosting,
          restore: restoreJobPosting,
        }}
        departmentActions={{
          create: createContentCategory,
          update: updateContentCategory,
          setActive: setContentCategoryActive,
          remove: deleteContentCategory,
        }}
      />
    </div>
  );
}
