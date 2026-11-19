import type { CategoryModule } from "./constants";

/** A category as the pages and the admin manager draw it. */
export interface CategoryView {
  id: string;
  module: CategoryModule;
  slug: string;
  name: string;
  sortOrder: number;
  active: boolean;
}

/** The columns a read names (never `select *`). */
export const CATEGORY_COLUMNS = "id, module, slug, name, sort_order, active";

interface CategoryRecord {
  id: string;
  module: string;
  slug: string;
  name: string;
  sort_order: number;
  active: boolean;
}

function isModule(value: string): value is CategoryModule {
  return value === "blog" || value === "faq" || value === "department";
}

/** Turns the rows into views, in the admin's order (sort order, then name). A row of an unknown list is dropped. */
export function toCategoryViews(rows: CategoryRecord[]): CategoryView[] {
  const views: CategoryView[] = [];
  for (const row of rows) {
    if (!isModule(row.module)) continue;
    views.push({
      id: row.id,
      module: row.module,
      slug: row.slug,
      name: row.name,
      sortOrder: row.sort_order,
      active: row.active,
    });
  }
  return views.sort(
    (first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name),
  );
}

/** A suggested slug for a name typed in the manager: lower case words joined by hyphens, cut to the limit. */
export function slugFromName(name: string, max = 60): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}
