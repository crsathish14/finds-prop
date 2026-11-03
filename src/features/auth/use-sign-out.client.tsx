"use client";

import { useState, useTransition } from "react";
import { signOut as signOutAction } from "./actions";
import { goTo } from "./navigate";

/**
 * What the avatar menu's "Sign out" entry calls (ADD-05/06 and the account menu in the header). It asks
 * the server to end this browser's session and then goes to `destination` with a full page load, so
 * nothing from the signed-in page stays on screen. If the server cannot end the session the visitor
 * stays where they are and `failed` is true, so the menu can say so; they must never be told they are
 * signed out when they are not. Customers go to the home page; staff pass their own sign-in page.
 */
export function useSignOut(destination = "/") {
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  function signOut() {
    if (pending) return;
    setFailed(false);
    startTransition(async () => {
      const result = await signOutAction({});
      if (result.ok) goTo(destination);
      else setFailed(true);
    });
  }

  return { signOut, pending, failed };
}
