import { FIELD_TYPES, FORM_KINDS, FORM_PLACEMENTS } from "@/features/forms";

/**
 * The kinds, placements and field types the editor offers. Read here, on the server, and passed to the editor by the
 * page: the editor runs in the browser and cannot import the forms feature's index (it also exports server-only code).
 */
export const EDITOR_LISTS = {
  kinds: FORM_KINDS,
  placements: FORM_PLACEMENTS,
  types: FIELD_TYPES,
} as const;
