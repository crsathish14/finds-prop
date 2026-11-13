import { z } from "zod";

/**
 * Runs in the browser before the app starts (Next.js instrumentation-client).
 *
 * Zod 4 probes whether the page may build functions from strings (`new Function("")`) so it can
 * compile faster parsers. Our content security policy does not allow that (DEC-37), so the probe
 * is refused: harmless, but the browser reports it as a policy violation on every page that
 * builds a schema. `jitless` skips the probe and uses the plain parsers, which is all a browser
 * form needs. Server code is not affected: this file is part of the browser bundle only.
 */
z.config({ jitless: true });
