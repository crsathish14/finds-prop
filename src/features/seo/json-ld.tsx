import { serializeJsonLd, type JsonLdDocument } from "./structured-data";

/**
 * Puts one structured-data document in the page. It is a data block (`application/ld+json`), which
 * the browser never runs, written as the text of the tag rather than as raw HTML: `serializeJsonLd`
 * has already escaped `<`, `>` and `&`, so what a seller typed can never close the tag.
 */
export function JsonLd({ data }: { data: JsonLdDocument }) {
  return <script type="application/ld+json">{serializeJsonLd(data)}</script>;
}
