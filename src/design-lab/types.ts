import type { ComponentType } from "react";

/** The five boards, each mirroring one UX design-system board (ADR-020). */
export type LabBoardId = "foundations" | "components" | "navigation" | "feedback" | "ads";

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
  /** The UX board this one mirrors. */
  uxBoard: string;
  summary: string;
  entries: LabEntry[];
};
