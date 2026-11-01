import { Suspense, type ReactNode } from "react";
import { PageGate } from "@/app/[locale]/_components/page-gate";

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <PageGate area="builder">{children}</PageGate>
    </Suspense>
  );
}
