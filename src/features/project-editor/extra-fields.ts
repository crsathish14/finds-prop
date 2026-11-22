/**
 * The extra text boxes the super admin adds to the project form (ADR-168), as far as the form and the save are
 * concerned. Pure: the page reads the definitions from the site content and passes them in, so the form, the save and
 * the tests all ask the same rules.
 */

/** The longest answer a box takes. */
export const EXTRA_VALUE_MAX = 500;

/** One box as the super admin defined it. */
export interface ExtraBox {
  id: string;
  label: string;
  hint?: string | undefined;
  required: boolean;
  /** The property types it is asked for; none means every type. */
  appliesTo: readonly string[];
  on: boolean;
}

/** True when the box is switched on and asked for this property type. */
export function boxApplies(box: ExtraBox, propertyType: string): boolean {
  return box.on && (box.appliesTo.length === 0 || box.appliesTo.includes(propertyType));
}

/** The boxes the form shows for this property type, in the super admin's order. */
export function boxesFor(boxes: readonly ExtraBox[], propertyType: string): ExtraBox[] {
  return boxes.filter((box) => boxApplies(box, propertyType));
}

export type ExtraAnswers = Record<string, string>;

/** The boxes that are required for this property type and have no answer, by box id. */
export function missingExtras(
  boxes: readonly ExtraBox[],
  propertyType: string,
  answers: Readonly<ExtraAnswers>,
): string[] {
  return boxesFor(boxes, propertyType)
    .filter((box) => box.required && (answers[box.id] ?? "").trim() === "")
    .map((box) => box.id);
}

/**
 * What is stored for a save. An answer is kept when its box still exists, whether the box is on or off or applies to
 * this property type or not (turning a box off must not lose what builders typed); blank answers are left out; an
 * answer whose box was deleted is dropped; control characters other than a line break are removed and the text is cut
 * to the limit.
 */
export function cleanExtras(
  boxes: readonly ExtraBox[],
  answers: Readonly<ExtraAnswers>,
): ExtraAnswers {
  const kept: ExtraAnswers = {};
  for (const box of boxes) {
    const typed = answers[box.id];
    if (typeof typed !== "string") continue;
    const clean = typed.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, "").trim();
    if (clean !== "") kept[box.id] = clean.slice(0, EXTRA_VALUE_MAX);
  }
  return kept;
}
