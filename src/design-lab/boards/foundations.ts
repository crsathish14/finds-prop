import type { LabEntry } from "../types";
import {
  ColourDemo,
  TypographyDemo,
  SpacingShapeDemo,
  FocusDemo,
  IconsDemo,
  LayoutDemo,
} from "./foundations-demos";

export const FOUNDATIONS: LabEntry[] = [
  {
    id: "colour",
    name: "Colour",
    description:
      "Every colour token, grouped by role, with the contrast of each text pair measured in this browser.",
    sources: [],
    Demo: ColourDemo,
  },
  {
    id: "typography",
    name: "Typography",
    description:
      "Heading, Text and Price: level and size are separate, small copper text uses the AA-safe tone.",
    sources: ["ui/heading.tsx", "ui/text.tsx", "ui/price.tsx"],
    Demo: TypographyDemo,
  },
  {
    id: "spacing-and-shape",
    name: "Spacing, shape and elevation",
    description: "The 4 px spacing scale, radii, shadows and border widths.",
    sources: [],
    Demo: SpacingShapeDemo,
  },
  {
    id: "focus",
    name: "Focus",
    description: "One focus ring everywhere, switching to light copper on dark surfaces.",
    sources: [],
    Demo: FocusDemo,
  },
  {
    id: "icons-and-brand",
    name: "Icons and brand",
    description:
      "Icon sizes, the icon set in use, the arch mark, the logo and the empty-state drawing.",
    sources: ["ui/icon.tsx", "ui/arch-mark.tsx", "ui/logo.tsx", "ui/arch-illustration.tsx"],
    Demo: IconsDemo,
  },
  {
    id: "layout",
    name: "Layout helpers",
    description: "Container widths, separator, visually hidden text and the skip link.",
    sources: [
      "layout/container.tsx",
      "ui/separator.tsx",
      "ui/visually-hidden.tsx",
      "ui/skip-link.tsx",
    ],
    Demo: LayoutDemo,
  },
];
