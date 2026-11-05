/**
 * The public id of a listing: 8 characters from a 32-letter alphabet with no look-alike characters
 * (no 0, 1, i, l or o). The database checks the same pattern (`properties.short_id`). It is in the
 * address of a property page (ADR-025) and in the compare selection (ADR-044).
 */
const SHORT_ID = /^[a-hjkmnp-z2-9]{8}$/;

export function isShortId(text: string): boolean {
  return SHORT_ID.test(text);
}
