import { RoutePlaceholder } from "@/app/[locale]/_components/route-placeholder";

export default function Page() {
  return <RoutePlaceholder route="/projects/[slug]" />;
}
