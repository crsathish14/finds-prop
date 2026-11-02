import { execFileSync } from "node:child_process";

/** The address and keys of the running local Supabase stack. Never printed, never written to a file. */
export interface LocalStack {
  url: string;
  publishableKey: string;
  serviceKey: string;
}

/** Reads the `KEY="value"` lines that `supabase status -o env` prints. */
export function parseStackEnvironment(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match?.[1] !== undefined && match[2] !== undefined) values[match[1]] = match[2];
  }
  return values;
}

/**
 * The integration tests create users and write rows, so they run only against the local stack
 * (R-DB-13): the address is read from the Supabase CLI and refused if it is anything else.
 */
export function readLocalStack(): LocalStack {
  let output: string;
  try {
    output = execFileSync("supabase", ["status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    throw new Error(
      "The integration tests need the local Supabase stack. Start it with `npm run db:start` (needs Docker); CI starts its own.",
    );
  }
  const values = parseStackEnvironment(output);
  const url = values["API_URL"];
  const publishableKey = values["PUBLISHABLE_KEY"] ?? values["ANON_KEY"];
  const serviceKey = values["SERVICE_ROLE_KEY"] ?? values["SECRET_KEY"];
  if (!url || !publishableKey || !serviceKey) {
    throw new Error(
      "`supabase status -o env` did not give an address and keys; is the stack fully started?",
    );
  }
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    throw new Error(
      "Refusing to run the integration tests against an address that is not the local stack.",
    );
  }
  return { url, publishableKey, serviceKey };
}
