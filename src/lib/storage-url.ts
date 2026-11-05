/**
 * The address of a file in a public storage bucket; each part of the path is encoded on its own. Used for
 * listing photos, project media and the site's sponsor banners.
 */
export function publicStorageUrl(supabaseUrl: string, bucket: string, path: string): string {
  const base = supabaseUrl.replace(/\/+$/, "");
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${bucket}/${encoded}`;
}

/** The public bucket that holds a project's pictures, floor plans and brochure. */
export const PROJECT_BUCKET = "project-media";
