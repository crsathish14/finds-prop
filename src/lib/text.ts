/**
 * Small rules for free text a developer or an owner typed, shared by the property and project pages.
 * Never HTML: the text is shown as text.
 */

/** The text as paragraphs: a blank line starts a new one, a single line break stays inside its paragraph. */
export function textParagraphs(text: string | null): string[] {
  if (text === null) return [];
  return text
    .split(/\r?\n[ \t]*\r?\n/)
    .map((paragraph) => paragraph.replace(/\r/g, "").trim())
    .filter((paragraph) => paragraph !== "");
}

/** A list of typed entries: trimmed, none empty, none twice (capitals ignored), in order. */
export function uniqueTexts(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const list: string[] = [];
  for (const entry of entries) {
    const text = entry.trim();
    const key = text.toLowerCase();
    if (text === "" || seen.has(key)) continue;
    seen.add(key);
    list.push(text);
  }
  return list;
}
