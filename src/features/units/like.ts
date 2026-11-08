/** `%`, `_` and `\` typed in the search box are letters to look for, not wildcards. */
export function escapeLike(typed: string): string {
  return typed.replace(/[\\%_]/g, (letter) => `\\${letter}`);
}
