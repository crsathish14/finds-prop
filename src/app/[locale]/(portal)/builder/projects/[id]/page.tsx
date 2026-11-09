import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getProjectForEdit,
  ProjectForm,
  projectIdSchema,
  updateMyProject,
} from "@/features/project-editor";
import { getTranslate } from "@/features/site";

type PageProps = { params: Promise<{ id: string }> };

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("builderPortal.projects.metaTitleEdit") };
}

/**
 * The builder's edit project page (S7-T03, FR-BLD-02): the same form, filled with what is stored. An address that is not
 * a project id, or a project that is not the builder's own, is "not found" (`my_projects()` returns only their own, so
 * another builder's project looks the same as one that does not exist). Read as the signed-in builder, never cached; the
 * role gate in the layout has already sent anyone else away.
 */
export default async function EditBuilderProjectPage({ params }: PageProps) {
  const { id } = await params;
  const parsed = projectIdSchema.safeParse({ projectId: id });
  if (!parsed.success) notFound();
  const project = await getProjectForEdit("builder", parsed.data.projectId);
  if (!project) notFound();
  return (
    <ProjectForm
      scope="builder"
      project={project}
      save={updateMyProject}
      backHref="/builder/projects"
      editBase="/builder/projects"
    />
  );
}
