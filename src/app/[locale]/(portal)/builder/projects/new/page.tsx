import type { Metadata } from "next";
import { createMyProject, ProjectForm } from "@/features/project-editor";
import { getTranslate } from "@/features/site";

// The portal layout already says the page is never indexed.
export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  return { title: translate("builderPortal.projects.metaTitleNew") };
}

/**
 * The builder's new project page (S7-T03, FR-BLD-02): the project form in the builder's mode, with the approval warning
 * on top and no admin boxes. Saving creates the project for the builder themselves (in review) and opens its edit page,
 * where images, floor plans and the brochure can be added.
 */
export default function NewBuilderProjectPage() {
  return (
    <ProjectForm
      scope="builder"
      project={null}
      save={createMyProject}
      backHref="/builder/projects"
      editBase="/builder/projects"
    />
  );
}
