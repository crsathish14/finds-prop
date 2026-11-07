import { publicEnv } from "@/lib/public-env";

/**
 * Sends a prepared photo to the one-time address the server issued (S6-T01, ADR-015 step 2). The address is
 * a bucket, a path and a token; the token is the permission, so no sign-in is sent along. This is the same
 * request the Supabase client makes for a signed upload (a PUT of the file to `/object/upload/sign/...`),
 * written out so the browser does not have to load the whole Supabase client for one request. The
 * integration test (`tests/integration/media.test.ts`) runs this function against the real storage service.
 */
export interface UploadTarget {
  bucket: string;
  path: string;
  token: string;
}

export type Fetcher = typeof fetch;

export async function uploadToTarget(
  target: UploadTarget,
  file: Blob,
  options: { baseUrl?: string; apiKey?: string; fetcher?: Fetcher } = {},
): Promise<{ ok: boolean }> {
  const baseUrl = options.baseUrl ?? publicEnv.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = options.apiKey ?? publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const send = options.fetcher ?? fetch;
  // Each segment of the path is encoded on its own, so the slashes stay.
  const encodedPath = target.path.split("/").map(encodeURIComponent).join("/");
  const url = new URL(
    `${baseUrl}/storage/v1/object/upload/sign/${encodeURIComponent(target.bucket)}/${encodedPath}`,
  );
  url.searchParams.set("token", target.token);
  try {
    const response = await send(url.toString(), {
      method: "PUT",
      headers: {
        apikey: apiKey,
        "content-type": file.type,
        // The file name is a fresh id that never changes, so it may be kept for a year.
        "cache-control": "max-age=31536000",
        "x-upsert": "false",
      },
      body: file,
    });
    return { ok: response.ok };
  } catch {
    return { ok: false };
  }
}
