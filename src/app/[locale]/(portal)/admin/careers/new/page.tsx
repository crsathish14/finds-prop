import type { Metadata } from "next";
import {
  closeJobPosting,
  createJobPosting,
  JobEditor,
  openJobPosting,
  updateJobPosting,
} from "@/features/careers";
import { getAdminCategories } from "@/features/content-categories";
import { getTranslate } from "@/features/site";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.careers.metaTitleNew") };
}

/**
 * The admin's new job page (ADR-143): the job form, in the department the list was narrowed to when it is one of ours. A
 * new job is a draft until the admin opens it. The departments are read as the signed-in admin.
 */
export default async function NewJobPage({ searchParams }: PageProps) {
  const [raw, translate, departments] = await Promise.all([
    searchParams,
    getTranslate(),
    getAdminCategories("department"),
  ]);
  const asked = Array.isArray(raw["department"]) ? raw["department"][0] : raw["department"];
  return (
    <JobEditor
      job={null}
      departments={departments.map((department) => ({
        value: department.id,
        label: department.active
          ? department.name
          : translate("admin.careers.hiddenDepartment", { name: department.name }),
      }))}
      {...(asked && departments.some((department) => department.id === asked)
        ? { initialDepartment: asked }
        : {})}
      actions={{ create: createJobPosting, update: updateJobPosting }}
      statusActions={{ open: openJobPosting, close: closeJobPosting }}
    />
  );
}
