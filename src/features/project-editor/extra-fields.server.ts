import "server-only";
import { getSiteSettings } from "@/features/site";
import { ActionError } from "@/server/actions/normalise-error";
import { cleanExtras, missingExtras, type ExtraBox } from "./extra-fields";

/** The extra boxes the super admin defined, in order: what the form asks and the save checks (ADR-168). */
export async function getExtraBoxes(): Promise<ExtraBox[]> {
  const { project_fields: setting } = await getSiteSettings();
  return setting.fields.map((field) => ({
    id: field.id,
    label: field.label,
    hint: field.hint,
    required: field.required,
    appliesTo: field.appliesTo,
    on: field.on,
  }));
}

/**
 * Checks a save's answers to the extra boxes against the boxes as they are now and returns the input with the answers
 * as they are stored. A required box that applies to the property type and is blank is a problem on that box; answers
 * of boxes that no longer exist are dropped. An input that sent no answers is left as it is (the stored ones stay).
 */
export async function withCleanExtras<
  Input extends { propertyType: string; extraFields?: Record<string, string> | undefined },
>(input: Input): Promise<Input> {
  if (input.extraFields === undefined) return input;
  const boxes = await getExtraBoxes();
  const missing = missingExtras(boxes, input.propertyType, input.extraFields);
  if (missing.length > 0) {
    throw new ActionError("VALIDATION", "A required extra box is empty", {
      fieldErrors: Object.fromEntries(
        missing.map((id) => [`extraFields.${id}`, [{ key: "validation.required" }]]),
      ),
    });
  }
  return { ...input, extraFields: cleanExtras(boxes, input.extraFields) };
}
