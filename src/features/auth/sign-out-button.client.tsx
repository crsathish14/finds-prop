"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { useSignOut } from "./use-sign-out.client";

type SignOutButtonProps = { label: string; failedText: string; destination: string };

/** Sign out as a button, for the menu drawer on phones (the avatar menu has its own entry). */
export function SignOutButton({ label, failedText, destination }: SignOutButtonProps) {
  const { signOut, pending, failed } = useSignOut(destination);

  useEffect(() => {
    if (failed) notify.error(failedText);
  }, [failed, failedText]);

  return (
    <Button variant="secondary" loading={pending} onClick={signOut}>
      {label}
    </Button>
  );
}
