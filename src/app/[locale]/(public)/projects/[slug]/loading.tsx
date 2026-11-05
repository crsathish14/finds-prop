import { ProjectSkeleton } from "@/features/projects";

/** The page's own outline while the project is read; the site header and footer are already there. */
export default function Loading() {
  return (
    <main id="main" className="flex-1">
      <ProjectSkeleton />
    </main>
  );
}
