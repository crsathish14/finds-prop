import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { readLocalStack } from "./tests/integration/support/local-stack";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// The address and keys come from the running local stack (`supabase status`), are handed to the
// tests through the environment, and are never printed. The hash secret is made fresh each run.
const stack = readLocalStack();

/**
 * Integration tests: real Supabase (Auth, Postgres, Storage) started from the migrations, with real
 * logins, and the real src/server code. They create users and rows, so they run one file at a time.
 * Unit and component tests use vitest.config.mts. See docs/engineering/testing.md.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fromRoot("./src"),
      // The real packages throw outside the matching bundler condition; tests run in plain Node.
      "server-only": fromRoot("./tests/stubs/empty.ts"),
      "client-only": fromRoot("./tests/stubs/empty.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    restoreMocks: true,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: {
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: stack.url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stack.publishableKey,
      SUPABASE_SERVICE_ROLE_KEY: stack.serviceKey,
      RATE_LIMIT_HMAC_SECRET: randomBytes(32).toString("hex"),
      APP_ENV: "local",
    },
  },
});
