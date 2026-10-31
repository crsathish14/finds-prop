import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { LabGate } from "@/design-lab/lab-gate";

// The Design Lab is for development and review: never indexed, and a 404 unless switched on.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function DesignSystemLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <LabGate>{children}</LabGate>
    </Suspense>
  );
}
