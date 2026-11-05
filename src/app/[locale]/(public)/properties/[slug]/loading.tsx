import { PropertySkeleton } from "@/features/property";

/** The page's own outline while the home is read; the site header and footer are already there. */
export default function Loading() {
  return (
    <main id="main" className="flex-1">
      <PropertySkeleton />
    </main>
  );
}
