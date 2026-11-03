"use client";

import { usePathname } from "next/navigation";
import { HeaderView, type HeaderViewProps } from "./header-view";

/** The header with the current page marked. Only the path is read here; everything else is props. */
export function HeaderFrame(props: Omit<HeaderViewProps, "pathname">) {
  return <HeaderView {...props} pathname={usePathname()} />;
}
