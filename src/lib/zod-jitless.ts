import { z } from "zod";

/**
 * Zod 4 probes whether the page may build functions from strings (`new Function("")`) so it can
 * compile faster parsers. Our content security policy does not allow that (DEC-37), so the probe
 * is refused: harmless, but the browser reports it as a policy violation on every page that
 * builds a schema. `jitless` skips the probe and uses the plain parsers, which is all a browser
 * form needs.
 *
 * Import this module for its effect, and import it FIRST in any browser entry that also imports a
 * module which parses a schema while loading (`public-env.ts` does): imports run in order, so the
 * setting is in place before the first schema is built. Server code is not affected.
 */
z.config({ jitless: true });
