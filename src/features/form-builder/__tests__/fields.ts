import type { FormField } from "@/features/forms";

/** A stored field as the schema gives it back: what is not set is there as undefined. */
export function field(
  own: Pick<FormField, "label" | "key" | "type"> & Partial<FormField>,
): FormField {
  return {
    placeholder: undefined,
    options: undefined,
    min: undefined,
    max: undefined,
    required: false,
    ...own,
  };
}
