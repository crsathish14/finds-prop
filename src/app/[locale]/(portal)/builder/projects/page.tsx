import type { Metadata } from "next";
import { BuilderProjects, getMyProjectList } from "@/features/project-editor";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("builderPortal.projects.metaTitle") };
}

/**
 * The builder's projects page (S7-T03, FR-BLD-02): the builder's own projects with their state, and Edit and View live.
 * The list is read as the signed-in builder (`my_projects()` returns only their own, whatever the state); the role gate
 * in the layout has already sent anyone else away.
 */
export default async function BuilderProjectsPage() {
  return <BuilderProjects rows={await getMyProjectList()} />;
}
