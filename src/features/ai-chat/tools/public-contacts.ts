/**
 * The two contact points a tool result may carry besides third-party text (ADR-128 section 6.4.3, point 4): a
 * project's public contact phone and a builder's website. Both were typed by the project's developer, so
 * neither is trusted as it stands: each is kept only if it has exactly the shape of a phone number or a web
 * address, and is `null` otherwise. A value that passes cannot hold a sentence for the model to follow. They
 * sit under their own keys (`contactPhone`, `website`) and not under `untrustedText` so that the output check
 * (a later task) can allow-list a number or a link in a reply by the key it came from, and by nothing else.
 */

/** The shape the database allows a project's phone to have: an optional plus and 6 to 15 digits. */
const PHONE = /^\+?[0-9]{6,15}$/;

/** The longest web address a result carries. */
const WEBSITE_MAX_CHARACTERS = 200;

/** The phone as the page's own check reads it, or null when it does not have that shape. */
export function publicPhone(text: string | null): string | null {
  const phone = text?.trim() ?? "";
  return PHONE.test(phone) ? phone : null;
}

/**
 * The website as an address a visitor may open: https or http, a host, no sign-in details in it, not longer
 * than `WEBSITE_MAX_CHARACTERS`. The address is written out as the browser would read it. Anything else is null.
 */
export function publicWebsite(text: string | null): string | null {
  const given = text?.trim() ?? "";
  if (given === "" || given.length > WEBSITE_MAX_CHARACTERS) return null;
  let url: URL;
  try {
    url = new URL(given);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname === "" || url.username !== "" || url.password !== "") return null;
  return url.href.length > WEBSITE_MAX_CHARACTERS ? null : url.href;
}
