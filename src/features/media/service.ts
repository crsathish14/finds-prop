import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/server/supabase/admin.server";
import { createServerSupabase } from "@/server/supabase/server";
import type { Database } from "@/types/database.types";
import { PHOTO_BUCKET, SWEEP_TOKEN_NAME } from "./constants";
import { mapMediaWriteError, type PhotoCallerStore, type PhotoServerStore } from "./media-service";
import type { SweepStore } from "./sweep";

/**
 * The part of the photo pipeline that touches the database and the storage service (S6-T01). It is on
 * the service-role allow-list (docs/engineering/security.md 4.3, eslint.config.mjs). Two kinds of access
 * live here and must not be mixed up:
 *
 *  - the caller's own, through their cookies and Row Level Security (`createPhotoCallerStore`): reading
 *    their listing, counting their photos, asking for an upload address, removing a photo row;
 *  - the server's, with the service role (`createPhotoServerStore`, `createSweepStore`): reading a stored
 *    file to check it, deleting a refused file, recording a photo through `finalize_listing_media`, and
 *    the sweep. The only callers are actions built with `defineAction` (which have already checked who
 *    is calling and counted the rate limit) and the sweep route (which has checked its token).
 */
export async function createPhotoCallerStore(): Promise<PhotoCallerStore> {
  return photoCallerStore(await createServerSupabase());
}

/** The same store for any client that acts as the caller (the integration tests sign in and pass theirs). */
export function photoCallerStore(supabase: SupabaseClient<Database>): PhotoCallerStore {
  return {
    async readOwnListing(listingId) {
      // `my_properties()` returns only the caller's own rows, drafts and pending ones included.
      const { data, error } = await supabase
        .rpc("my_properties")
        .select("id, short_id, status")
        .eq("id", listingId)
        .maybeSingle();
      if (error) throw mapMediaWriteError({ code: error.code, message: error.message });
      return data ? { id: data.id, shortId: data.short_id, status: data.status } : null;
    },
    async countPhotos(listingId) {
      const { count, error } = await supabase
        .from("listing_media")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId);
      if (error) throw mapMediaWriteError({ code: error.code, message: error.message });
      return count ?? 0;
    },
    async createSignedUpload(path) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
      if (error || !data) throw mapMediaWriteError({});
      return { token: data.token };
    },
    async deletePhotoRow(listingId, photoId) {
      const { data, error } = await supabase
        .from("listing_media")
        .delete()
        .eq("id", photoId)
        .eq("listing_id", listingId)
        .select("storage_path");
      if (error) throw mapMediaWriteError({ code: error.code, message: error.message });
      const row = data[0];
      return row ? { storagePath: row.storage_path } : null;
    },
  };
}

export function createPhotoServerStore(requestId: string): PhotoServerStore {
  const client = createAdminSupabase(requestId);
  return {
    async download(path) {
      const { data, error } = await client.storage.from(PHOTO_BUCKET).download(path);
      if (error || !data) return null;
      return new Uint8Array(await data.arrayBuffer());
    },
    async deleteObject(path) {
      const { error } = await client.storage.from(PHOTO_BUCKET).remove([path]);
      if (error) throw mapMediaWriteError({});
    },
    async finalize(row) {
      const { data, error } = await client.rpc("finalize_listing_media", {
        p_owner: row.ownerId,
        p_listing: row.listingId,
        p_path: row.path,
        p_mime: row.mime,
        p_bytes: row.bytes,
        p_width: row.width,
        p_height: row.height,
      });
      if (error || typeof data !== "string") {
        throw mapMediaWriteError({ code: error?.code, message: error?.message });
      }
      return data;
    },
  };
}

/** The sweep's database and storage access (service role). */
export function createSweepStore(requestId: string): SweepStore {
  const client = createAdminSupabase(requestId);
  return {
    async readToken() {
      const { data, error } = await client
        .from("internal_cron_tokens")
        .select("token")
        .eq("name", SWEEP_TOKEN_NAME)
        .maybeSingle();
      if (error) throw mapMediaWriteError({ code: error.code, message: error.message });
      return data?.token ?? null;
    },
    async listOrphans(olderThanHours, limit) {
      const { data, error } = await client.rpc("orphan_listing_photos", {
        p_older_than_hours: olderThanHours,
        p_limit: limit,
      });
      if (error) throw mapMediaWriteError({ code: error.code, message: error.message });
      return data.map((row) => row.name);
    },
    async removeObjects(paths) {
      const { error } = await client.storage.from(PHOTO_BUCKET).remove(paths);
      if (error) throw mapMediaWriteError({});
    },
  };
}
