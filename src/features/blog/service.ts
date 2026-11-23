import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { BLOG_IMAGE_BUCKET } from "./constants";
import { mapBlogError, type BlogStore, type PostPatch } from "./post-service";

/**
 * The Blog's admin writes reach the database and the bucket here: as the signed-in admin through their cookies, so the
 * service role is not used. The table's policies let only the super admin insert and update, and the `site-assets`
 * bucket's policies let only the super admin write, so a call from anyone else is refused whatever the action did
 * before it. The only callers are actions built with `defineAction`, which have already checked the role.
 */
export async function createBlogStore(): Promise<BlogStore> {
  return blogStore(await createServerSupabase());
}

const STORED_COLUMNS = "id, slug, title, excerpt, body, status, deleted_at, cover_path, cover_alt";

/** The same store for any client that acts as the admin (the integration tests sign in and pass theirs). */
export function blogStore(supabase: SupabaseClient<Database>): BlogStore {
  return {
    async insert(row) {
      const { data, error } = await supabase
        .from("blog_posts")
        .insert(row)
        .select("id, slug")
        .single();
      if (error) throw mapBlogError(error);
      return { postId: data.id, slug: data.slug };
    },

    async read(postId) {
      const { data, error } = await supabase
        .from("blog_posts")
        .select(STORED_COLUMNS)
        .eq("id", postId)
        .maybeSingle();
      if (error) throw mapBlogError(error);
      if (!data) return null;
      return {
        id: data.id,
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt,
        body: data.body,
        status: data.status,
        deletedAt: data.deleted_at,
        coverPath: data.cover_path,
        coverAlt: data.cover_alt,
      };
    },

    async update(postId, patch: PostPatch) {
      const { data, error } = await supabase
        .from("blog_posts")
        .update(patch)
        .eq("id", postId)
        .select("id");
      if (error) throw mapBlogError(error);
      if (data.length === 0) throw mapBlogError({ code: "P0002" });
    },

    async fetchImage(path) {
      const { data, error } = await supabase.storage.from(BLOG_IMAGE_BUCKET).download(path);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },

    async removeFiles(paths) {
      const { error } = await supabase.storage.from(BLOG_IMAGE_BUCKET).remove([...paths]);
      if (error) throw new Error("The pictures could not be removed");
    },
  };
}
