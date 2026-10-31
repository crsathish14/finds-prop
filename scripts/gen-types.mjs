// Generates src/types/database.types.ts from the local Supabase stack (needs Docker).
// `--check` writes to a temp file and fails if it differs from the committed file (gate G-07).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { repoRoot } from "./lib/core.mjs";

const target = path.join(repoRoot, "src", "types", "database.types.ts");
const check = process.argv.includes("--check");

const result = spawnSync("supabase", ["gen", "types", "typescript", "--local"], {
  cwd: repoRoot,
  encoding: "utf8",
  shell: process.platform === "win32",
  maxBuffer: 50 * 1024 * 1024,
});
if (result.error || result.status !== 0) {
  console.error(
    "gen-types: could not run `supabase gen types typescript --local`. Is Docker running and `npm run db:start` done?",
  );
  if (result.stderr) console.error(result.stderr.split("\n").slice(0, 5).join("\n"));
  process.exit(1);
}
const generated = result.stdout.replace(/\r\n/g, "\n");

if (check) {
  const current = fs.existsSync(target)
    ? fs.readFileSync(target, "utf8").replace(/\r\n/g, "\n")
    : "";
  if (current !== generated) {
    const tmp = path.join(os.tmpdir(), "database.types.generated.ts");
    fs.writeFileSync(tmp, generated);
    console.error(
      `gen-types: src/types/database.types.ts is out of date with the migrations. Run npm run gen:types and commit the result. (Fresh output: ${tmp})`,
    );
    // A CI runner's temp folder is gone after the job, so show the fresh file in the log.
    if (process.env.CI) {
      console.error(`----- fresh output -----\n${generated}----- end fresh output -----`);
    }
    process.exit(1);
  }
  console.log("gen-types: ok");
} else {
  fs.writeFileSync(target, generated);
  console.log("gen-types: wrote src/types/database.types.ts");
}
