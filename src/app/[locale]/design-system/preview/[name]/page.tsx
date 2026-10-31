import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { PREVIEW_NAMES } from "@/design-lab/preview-names";
import { PREVIEWS } from "@/design-lab/previews";

export function generateStaticParams() {
  return PREVIEW_NAMES.map((name) => ({ name }));
}

export default async function PreviewPage({
  params,
}: PageProps<"/[locale]/design-system/preview/[name]">) {
  const { name } = await params;
  const render = (PREVIEWS as Record<string, (() => ReactNode) | undefined>)[name];
  if (!render) notFound();
  return render();
}
