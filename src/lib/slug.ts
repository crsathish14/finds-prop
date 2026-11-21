/**
 * A web address word made from a name (shared by the admin screens that suggest one as the admin types): lower case words
 * joined by hyphens, accents dropped, cut to the limit. Pure, so a client island can use it.
 */
export function slugFromName(name: string, max = 60): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}
