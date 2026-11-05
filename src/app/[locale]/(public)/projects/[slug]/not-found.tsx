import { ProjectNotFound } from "@/features/projects";

/** "Project not found": a wrong address, or a project that is not approved and published. */
export default function NotFound() {
  return (
    <main id="main" className="flex-1">
      <ProjectNotFound />
    </main>
  );
}
