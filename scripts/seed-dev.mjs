// S3-T13: gives the fictional seed (supabase/seed.sql) its test users, photo files and listing_media rows.
//
//   node scripts/seed-dev.mjs             the local stack (read from `supabase status`; needs Docker)
//   node scripts/seed-dev.mjs --hosted    a hosted project: needs SEED_SUPABASE_URL, SEED_SERVICE_ROLE_KEY
//                                         and SEED_ALLOW_URL (the same address) in YOUR terminal
//
// It writes to a database, so it refuses anything but the local stack unless the caller names the hosted
// project twice (R-DB-13). A hosted project has none of the seed.sql data (db-deploy applies
// migrations only, ADR-034), so on one this stops with a message. It never prints a key, an address or a
// phone number, and the reserved administrator is created on the local stack only.
import { execFileSync } from "node:child_process";
import { runSeedDev, SeedRefusal } from "./lib/seed-dev-core.mjs";

const hosted = process.argv.includes("--hosted");

/** The address and service key of the running local stack, from the Supabase CLI. */
function readLocalStack() {
  let output;
  try {
    output = execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new SeedRefusal("could not read the local stack; is it running (supabase start)?");
  }
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match) values[match[1]] = match[2];
  }
  return { url: values.API_URL, key: values.SERVICE_ROLE_KEY ?? values.SECRET_KEY };
}

async function main() {
  let url = process.env.SEED_SUPABASE_URL;
  let key = process.env.SEED_SERVICE_ROLE_KEY;
  if (!url || !key) {
    if (hosted) {
      throw new SeedRefusal(
        "a hosted project needs SEED_SUPABASE_URL, SEED_SERVICE_ROLE_KEY and SEED_ALLOW_URL",
      );
    }
    ({ url, key } = readLocalStack());
  }
  const result = await runSeedDev({
    fetch,
    url,
    key,
    hosted,
    allowedUrl: process.env.SEED_ALLOW_URL,
    log: (message) => console.log(`seed-dev: ${message}`),
  });
  console.log(`seed-dev: done (${result.users} test users)`);
}

main().catch((error) => {
  const kind = error instanceof SeedRefusal ? "refused" : "failed";
  console.error(`seed-dev: ${kind}: ${error.message}`);
  process.exit(1);
});
