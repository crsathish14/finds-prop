import type { Metadata } from "next";
import {
  createProject,
  getBuilderOptions,
  getFormOptions,
  ProjectForm,
} from "@/features/project-editor";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("admin.projectForm.metaTitleNew") };
}

/**
 * The admin's new project page (S7-T02, FR-ADM-04): the sectioned form for a project, for the builder the admin names.
 * The builders and the forms to choose from are read as the signed-in admin; the role gate in the layout has already
 * sent anyone else away. Saving creates the project (in review) and opens its edit page, where media and price trends
 * can be added.
 */
export default async function NewProjectPage() {
  const [builders, forms] = await Promise.all([getBuilderOptions(), getFormOptions()]);
  return (
    <ProjectForm
      scope="admin"
      project={null}
      builders={builders}
      forms={forms}
      save={createProject}
      backHref="/admin/projects"
      editBase="/admin/projects"
    />
  );
}
