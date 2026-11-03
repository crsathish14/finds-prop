"use client";

import { useRequestBottomBar } from "@/lib/bottom-bar-request";

/** Put this in a server-rendered error page (not-found) so the phone bottom bar shows with it. */
export function RequestBottomBar() {
  useRequestBottomBar();
  return null;
}
