import type { Metadata } from "next";
import { connection } from "next/server";
import { ProjectCard } from "@/components/domain/project-card";
import {
  isSignedOut,
  LoginWallScreen,
  loginWallHref,
  loginWallMetadata,
} from "@/features/login-wall";
import { getProjects, PROJECTS_PATH, ProjectsScreen, toProjectCard } from "@/features/projects";
import { pageMetadata } from "@/features/seo";
import { getSiteSettings, getTranslate } from "@/features/site";
import { publicEnv } from "@/lib/public-env";

export async function generateMetadata(): Promise<Metadata> {
  const translate = await getTranslate();
  if (await isSignedOut()) return loginWallMetadata(translate);
  return pageMetadata({
    title: translate("projects.list.metaTitle"),
    description: translate("projects.list.metaDescription"),
    path: PROJECTS_PATH,
    siteName: translate("meta.title"),
  });
}

/** The first cards are above the fold on every width, so their pictures load at once. */
const PRIORITY_CARDS = 3;

/**
 * The projects page (S4-T09, ADR-046): the approved and published projects as cards, featured first.
 * The page asks for the request first, so a failed read is never baked into the page ahead of time:
 * every visit reads through the cache (minutes), and `loading.tsx` stands in while it is on its way.
 */
export default async function ProjectsPage() {
  await connection();
  // The list is for signed-in visitors (ADR-171): anyone else gets the wall and no read at all.
  const wallHref = await loginWallHref(PROJECTS_PATH);
  if (wallHref !== null) {
    return (
      <main id="main" className="flex-1">
        <LoginWallScreen kind="projects" signInHref={wallHref} />
      </main>
    );
  }
  const [list, settings] = await Promise.all([getProjects(), getSiteSettings()]);
  const projects = list.status === "ok" ? list.projects : [];
  return (
    <main id="main" className="flex-1">
      <ProjectsScreen
        status={list.status}
        regionName={settings.region.name}
        browseHref="/properties"
        cards={projects.map((project, index) => (
          <ProjectCard
            key={project.slug}
            project={toProjectCard(project, publicEnv.NEXT_PUBLIC_SUPABASE_URL)}
            priority={index < PRIORITY_CARDS}
          />
        ))}
      />
    </main>
  );
}
