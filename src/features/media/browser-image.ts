import { browserImageDeps } from "@/lib/image-browser";
import type { PrepareDeps } from "./prepare-photo";

/**
 * The browser's own decoding and encoding for `preparePhoto` (S6-SPK-01). The code is shared with the other uploads'
 * "reduce size" step and lives in `@/lib/image-browser`; this file only gives it the type `preparePhoto` asks for.
 */
export const browserImage: PrepareDeps = browserImageDeps;
