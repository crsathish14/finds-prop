import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/** Unit and component tests. Integration tests (real local Supabase) use vitest.integration.config.ts from Stage 3. */
export default defineConfig({
  plugins: [react()],
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
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs", ".claude/**/*.test.mjs"],
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Non-secret placeholders so modules that parse the environment at import time can load.
    env: {
      NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-placeholder-key",
    },
  },
});
