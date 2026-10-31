import type { LabEntry } from "../types";
import {
  ButtonsDemo,
  IconButtonsDemo,
  LinksDemo,
  FieldsDemo,
  SpecialFieldsDemo,
  ComboboxDemo,
  UploadDemo,
  ChipsDemo,
  BadgesDemo,
  CardPartsDemo,
  AvatarDemo,
  SortableDemo,
} from "./components-demos";

export const COMPONENTS: LabEntry[] = [
  {
    id: "buttons",
    name: "Buttons",
    description:
      "Six variants in default, disabled and loading, three sizes, pill, icons, and a link with the button look.",
    sources: ["ui/button.tsx"],
    Demo: ButtonsDemo,
  },
  {
    id: "icon-buttons",
    name: "Icon buttons",
    description: "44 px round buttons with a required label; a toggle announces its state.",
    sources: ["ui/icon-button.tsx"],
    Demo: IconButtonsDemo,
  },
  {
    id: "links",
    name: "Links",
    description:
      "Default, arrow, nav and on-dark; external and sponsored links are safe; a sponsored link that is not https is text.",
    sources: ["ui/link.tsx"],
    Demo: LinksDemo,
  },
  {
    id: "fields",
    name: "Fields",
    description: "Input, textarea, select, checkbox, radio, switch and label in every state.",
    sources: [
      "ui/input.tsx",
      "ui/textarea.tsx",
      "ui/native-select.tsx",
      "ui/checkbox.tsx",
      "ui/radio-group.tsx",
      "ui/switch.tsx",
      "ui/label.tsx",
    ],
    Demo: FieldsDemo,
  },
  {
    id: "form-fields",
    name: "Form fields",
    description:
      "FormField wires the label, hint and error; phone, password and one-time-code fields.",
    sources: [
      "patterns/form-field.tsx",
      "patterns/phone-field.tsx",
      "patterns/password-field.tsx",
      "patterns/otp-input.tsx",
    ],
    Demo: SpecialFieldsDemo,
  },
  {
    id: "combobox",
    name: "Combobox",
    description:
      "Locality search: suggestions 300 ms after typing stops, from 3 characters, keyboard and screen reader operable (ADR-037).",
    sources: ["patterns/combobox.tsx"],
    Demo: ComboboxDemo,
  },
  {
    id: "upload-zone",
    name: "Upload zone",
    description:
      "Drop area and file picker with progress, errors, a cover tag and named remove buttons. Interface only.",
    sources: ["patterns/upload-zone.tsx"],
    Demo: UploadDemo,
  },
  {
    id: "chips",
    name: "Chips and segmented control",
    description: "Toggle chips, removable chips and the segmented control, including a link-tab.",
    sources: ["ui/chip.tsx", "ui/removable-chip.tsx", "ui/segmented-control.tsx"],
    Demo: ChipsDemo,
  },
  {
    id: "badges",
    name: "Badges and statuses",
    description: "Badge tones, and the one status map: a status is always a word with a dot.",
    sources: ["ui/badge.tsx", "patterns/status-badge.tsx"],
    Demo: BadgesDemo,
  },
  {
    id: "card-parts",
    name: "Card parts",
    description: "Prices, property facts, spec and stat tiles, and Show more.",
    sources: [
      "patterns/price-display.tsx",
      "patterns/property-meta.tsx",
      "patterns/spec-tile.tsx",
      "patterns/stat-tile.tsx",
      "patterns/show-more.tsx",
    ],
    Demo: CardPartsDemo,
  },
  {
    id: "avatar",
    name: "Avatar",
    description: "A person's initials, or their picture.",
    sources: ["ui/avatar.tsx"],
    Demo: AvatarDemo,
  },
  {
    id: "sortable",
    name: "Sortable rows",
    description: "Reorder by dragging the grip, or with Move up and Move down.",
    sources: ["patterns/sortable-list.tsx"],
    Demo: SortableDemo,
  },
];
