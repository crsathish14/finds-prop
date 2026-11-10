import type { ComponentType } from "react";

/**
 * The five boards that mirror the approved UX design-system boards (ADR-020), and "domain", which
 * shows the organisms that only appear inside the screens (the cards, search and detail parts), and "discovery": what spans the screens when choosing homes
 * (the compare bar and the comparison, the projects page and the project page), and "seller": what an owner uses to post a property (the wizard's parts).
 */
export type LabBoardId =
  | "foundations"
  | "components"
  | "navigation"
  | "feedback"
  | "ads"
  | "domain"
  | "discovery"
  | "seller"
  | "admin"
  | "site-content"
  | "sponsors"
  | "forms"
  | "crm"
  | "charts";

export type LabEntry = {
  /** Anchor on the board page: lowercase words joined by hyphens. */
  id: string;
  name: string;
  description: string;
  /** The shared component files this entry shows, relative to src/components, e.g. "ui/button.tsx". */
  sources: string[];
  Demo: ComponentType;
};

export type LabBoard = {
  id: LabBoardId;
  title: string;
  /** The UX board or screen this one mirrors (a file in docs/ux/final-ux/screens). */
  uxBoard: string;
  summary: string;
  entries: LabEntry[];
};
