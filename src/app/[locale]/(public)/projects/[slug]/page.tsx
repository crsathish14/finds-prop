import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PROJECT_BUCKET, publicStorageUrl } from "@/features/home";
import {
  canonicalProjectPath,
  contactLinks,
  getProject,
  parseProjectSlug,
  ProjectLeadCard,
  ProjectMobileBar,
  projectMetaDescription,
  projectPath,
  PROJECTS_PATH,
  ProjectScreen,
  projectStructuredData,
} from "@/features/projects";
import { absoluteUrl, breadcrumbList, JsonLd, pageMetadata } from "@/features/seo";
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
  const cover = project.images[0];
  return pageMetadata({
    title: project.seoTitle?.trim() || project.name,
    description:
      projectMetaDescription(project) ??
      translate("projects.page.metaFallback", {
        name: project.name,
        developer: project.developer.name,
        locality: project.locality,
      }),
    path: projectPath(project.slug),
    siteName: translate("meta.title"),
    image:
      cover === undefined
        ? null
        : publicStorageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, PROJECT_BUCKET, cover),
    imageAlt: project.name,
  });
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

  const translate = await getTranslate();
  const source = (path: string) =>
    publicStorageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, PROJECT_BUCKET, path);
  const imageSources = project.images.map(source);
  const url = absoluteUrl(projectPath(project.slug));

  return (
    // `pb-24` leaves room under the last section for the phone's bar (hidden from 1024 px).
    <main id="main" className="flex-1 pb-24 lg:pb-0">
      <JsonLd data={projectStructuredData(project, { url, images: imageSources })} />
      <JsonLd
        data={breadcrumbList([
          { name: translate("projects.page.crumb.home"), url: absoluteUrl("/") },
          { name: translate("projects.page.crumb.projects"), url: absoluteUrl(PROJECTS_PATH) },
          { name: project.name, url },
        ])}
      />
      <ProjectScreen
        project={project}
        imageSources={imageSources}
        floorPlanSources={project.floorPlans.map(source)}
        brochureSource={project.brochurePath === null ? null : source(project.brochurePath)}
        enquiry={
          <ProjectLeadCard
            state="form"
            sendDisabled
            sendNotice={translate("projects.page.lead.notOpen")}
          />
        }
        mobileEnquiry={<ProjectMobileBar contact={contactLinks(project.contactPhone)} />}
      />
    </main>
  );
}
