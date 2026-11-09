import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getBuilderOptions,
  getFormOptions,
  getProjectForEdit,
  ProjectForm,
  projectIdSchema,
  updateProject,
} from "@/features/project-editor";
import { getTranslate } from "@/features/site";

type PageProps = { params: Promise<{ id: string }> };

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.projectForm.metaTitleEdit") };
}

/**
 * The admin's edit project page (S7-T02, FR-ADM-04): the same form, filled with what is stored, with the media section
 * and the price trends open. An address that is not a project id, or a project that does not exist, is "not found". The
 * project, the builders and the forms are read as the signed-in admin (never cached, so the form opens with what is
 * stored); the role gate in the layout has already sent anyone else away.
 */
export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;
  const parsed = projectIdSchema.safeParse({ projectId: id });
  if (!parsed.success) notFound();
  const [project, builders, forms] = await Promise.all([
    getProjectForEdit("admin", parsed.data.projectId),
    getBuilderOptions(),
    getFormOptions(),
  ]);
  if (!project) notFound();
  return (
    <ProjectForm
      scope="admin"
      project={project}
      builders={builders}
      forms={forms}
      save={updateProject}
      backHref="/admin/projects"
      editBase="/admin/projects"
    />
  );
}
