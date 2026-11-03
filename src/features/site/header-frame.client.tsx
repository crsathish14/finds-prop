"use client";

import { useClientPathname } from "./client-pathname";
import { HeaderView, type HeaderViewProps } from "./header-view";

/**
 * The header with the current page marked. Only the path is read here, and only after hydration
 * (see useClientPathname); everything else is props.
 */
export function HeaderFrame(props: Omit<HeaderViewProps, "pathname">) {
  return <HeaderView {...props} pathname={useClientPathname()} />;
}
