"use client";

import { Link } from "@/components/ui/link";
import { signInHref } from "./chrome";
import { useClientPathname } from "@/lib/client-pathname";

/**
 * The header's Sign in link, which asks to come back to the page the visitor is on. Until the page
 * is hydrated it goes to plain sign-in, so the server and first browser render agree.
 */
export function SignInLink({ label }: { label: string }) {
  const pathname = useClientPathname();
  return (
    <Link
      href={pathname === undefined ? "/auth" : signInHref(pathname)}
      variant="nav"
      className="px-3 py-3 text-primary no-underline"
    >
      {label}
    </Link>
  );
}
