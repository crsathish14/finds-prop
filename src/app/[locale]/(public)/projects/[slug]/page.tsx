import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PROJECT_BUCKET, publicStorageUrl } from "@/features/home";
import {
  canonicalProjectPath,
  getProject,
  parseProjectSlug,
  projectMetaDescription,
  ProjectScreen,
} from "@/features/projects";
import { getTranslate } from "@/features/site";
import { publicEnv } from "@/lib/public-env";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const parsed = parseProjectSlug(slug);
  const translate = await getTranslate();
  if (parsed === null) return { title: translate("projects.page.notFound.title") };
  const result = await getProject(parsed);
  if (result.status === "missing") return { title: translate("projects.page.notFound.title") };
  const { project } = result;
  const description = projectMetaDescription(project);
  return {
    title: project.seoTitle?.trim() || project.name,
    ...(description === null ? {} : { description }),
  };
}

/**
 * The project page (S4-T09, ADR-046). The address is the project's own slug; the project is read by it.
 * An address that is not a slug, or a slug no approved and published project has, is "not found"; a
 * slug written with capitals is sent (308) to the canonical address. The details are read-only: the
 * enquiry form and the contact events are a later task.
 */
export default async function ProjectPage({ params }: PageProps) {
  const { slug } = await params;
  const parsed = parseProjectSlug(slug);
  if (parsed === null) notFound();
  const result = await getProject(parsed);
  if (result.status === "missing") notFound();
  const { project } = result;

  const canonical = canonicalProjectPath(slug, project.slug);
  if (canonical !== null) permanentRedirect(canonical);

  const source = (path: string) =>
    publicStorageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, PROJECT_BUCKET, path);

  return (
    <main id="main" className="flex-1">
      <ProjectScreen
        project={project}
        imageSources={project.images.map(source)}
        floorPlanSources={project.floorPlans.map(source)}
        brochureSource={project.brochurePath === null ? null : source(project.brochurePath)}
      />
    </main>
  );
}
