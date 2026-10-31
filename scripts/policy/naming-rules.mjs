// R-GEN-11: names are words. One definition, used by eslint.config.mjs (gate G-02) and by the
// Claude Code hook .claude/hooks/check-naming.mjs, so the two can never disagree.
export const NAMING_RULES = {
  // No single letters for variables, parameters, callbacks, functions or object keys.
  "id-length": ["error", { min: 2, exceptions: ["_"], properties: "always" }],
  // Cryptic shorthand. `msg` is not listed: it is the documented key in the JSON log line.
  "id-denylist": [
    "error",
    "err",
    "cb",
    "fn",
    "el",
    "tmp",
    "arr",
    "obj",
    "val",
    "str",
    "num",
    "idx",
    "evt",
    "ctx",
    "opts",
  ],
};
