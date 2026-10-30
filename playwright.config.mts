import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * End-to-end tests run against the production build (`npm run build` first) so they exercise what
 * ships. Viewport projects (390, 820, 1024, 1280, 1440), WebKit and Firefox smoke arrive with the
 * design system (Stage 2) and the nightly workflow.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [
    { name: "smoke", testIgnore: /design-lab\//, use: { ...devices["Desktop Chrome"] } },
    {
      name: "design-lab",
      testMatch: /design-lab\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
