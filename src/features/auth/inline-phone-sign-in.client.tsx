"use client";

import { useRouter } from "next/navigation";
import { PhoneSignIn } from "./phone-sign-in.client";

/**
 * The phone sign-in inside another page's card (the login wall, ADR-171): the number step and the code step of
 * `/auth`, with the same actions, limits and words, and no navigation. Once the code is right the page refreshes its
 * server data in place: the address and its filters stay, and the page draws what the visitor came for.
 */
export function InlinePhoneSignIn({ siteKey }: { siteKey: string | undefined }) {
  const router = useRouter();
  return <PhoneSignIn siteKey={siteKey} onSignedIn={() => router.refresh()} />;
}
