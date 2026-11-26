import type { Metadata } from "next";
import {
  AdminProjects,
  deleteProject,
  getAdminProjects,
  moderateProject,
} from "@/features/project-moderation";
import { getTranslate } from "@/features/site";
import { indiaToday } from "@/lib/india-days";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.projects.metaTitle") };
}

/**
 * The admin's projects page (S7-T04, FR-ADM-03): every builder's projects with their state, and the decision each one
 * needs (approve, reject, publish, unpublish), feature, edit, view live and delete. The list is read as the signed-in
 * admin (`admin_project_overview()` checks that itself); the role gate in the layout has already sent anyone else away.
 */
export default async function AdminProjectsPage() {
  const { projects, truncated } = await getAdminProjects();
  // Today in India, for the Scheduled, Running or Ended tag of a Featured with dates (ADR-210).
  const today = indiaToday(new Date());
  return (
    <AdminProjects
      rows={projects}
      truncated={truncated}
      actions={{ moderate: moderateProject, remove: deleteProject }}
      today={today}
    />
  );
}
