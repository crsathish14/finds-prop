import { isSafeRedirectPath } from "@/lib/url/safe-redirect";

/**
 * proxy.ts records the address of each page request in this header, so a layout (which does not
 * know its own address) can send a signed-out visitor to sign-in and back again. The proxy always
 * overwrites any value a caller sent; the reader still refuses anything that is not a safe path.
 */
export const RETURN_PATH_HEADER = "x-return-path";

export function readReturnPath(headers: Pick<Headers, "get">): string | undefined {
  const value = headers.get(RETURN_PATH_HEADER);
  return isSafeRedirectPath(value) ? value : undefined;
}
