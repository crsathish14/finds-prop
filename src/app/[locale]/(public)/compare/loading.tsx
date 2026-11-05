import { CompareSkeleton } from "@/features/compare";

/** The comparison's own outline while its homes are read; the site header and footer are already there. */
export default function Loading() {
  return (
    <main id="main" className="flex-1">
      <CompareSkeleton />
    </main>
  );
}
