"use client";

import { usePathname } from "next/navigation";
import { Link } from "@/components/ui/link";
import { signInHref } from "./chrome";

/** The header's Sign in link, which asks to come back to the page the visitor is on. */
export function SignInLink({ label }: { label: string }) {
  return (
    <Link
      href={signInHref(usePathname())}
      variant="nav"
      className="px-3 py-3 text-primary no-underline"
    >
      {label}
    </Link>
  );
}
