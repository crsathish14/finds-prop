import { RoutePlaceholder } from "../../../_components/route-placeholder";

// The portal layout already says the page is never indexed. The real page replaces this one in its own phase (ADR-143).
export default function AdminPage() {
  return <RoutePlaceholder route="/admin/careers" framed />;
}
