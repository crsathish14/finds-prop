import { ContentModulePageBar, getContentModulesView } from "@/features/content-modules";
import { saveContentModules } from "@/features/site-content";
import { RoutePlaceholder } from "../../../_components/route-placeholder";

// The portal layout already says the page is never indexed. The real page replaces the placeholder in its own phase
// (ADR-143) and keeps the switch bar at its top: the page keeps working while the module is hidden.
export default async function AdminPage() {
  const modules = await getContentModulesView();
  return (
    <div className="flex flex-col gap-6">
      <ContentModulePageBar module="careers" modules={modules} save={saveContentModules} />
      <RoutePlaceholder route="/admin/careers" framed />
    </div>
  );
}
