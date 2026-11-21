import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  adminJobsHref,
  closeJobPosting,
  createJobPosting,
  getAdminJob,
  JobEditor,
  openJobPosting,
  updateJobPosting,
} from "@/features/careers";
import { getAdminCategories } from "@/features/content-categories";
import { getTranslate } from "@/features/site";

type PageProps = { params: Promise<{ id: string }> };

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.careers.metaTitleEdit") };
}

const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The admin's edit job page (ADR-143, ADR-147): the form filled with what is stored. An address that is not a job id or
 * a job that does not exist is "not found"; one in the Trash is sent to the Trash tab of the list (restore it there
 * first, because the save refuses a trashed job). Read as the signed-in admin and never cached, so the form opens with
 * what is stored; it is keyed by the last change, so it opens again fresh after each save.
 */
export default async function EditJobPage({ params }: PageProps) {
  const { id } = await params;
  if (!ID.test(id)) notFound();
  const [job, departments, translate] = await Promise.all([
    getAdminJob(id.toLowerCase()),
    getAdminCategories("department"),
    getTranslate(),
  ]);
  if (!job) notFound();
  if (job.trashed) redirect(adminJobsHref({ status: "trash" }));
  return (
    <JobEditor
      key={job.updatedAt}
      job={job}
      departments={departments.map((department) => ({
        value: department.id,
        label: department.active
          ? department.name
          : translate("admin.careers.hiddenDepartment", { name: department.name }),
      }))}
      actions={{ create: createJobPosting, update: updateJobPosting }}
      statusActions={{ open: openJobPosting, close: closeJobPosting }}
    />
  );
}
