import { defineConfig } from "@playwright/test";

import { E2E_DATABASE, E2E_PORT } from "./e2e/constants";

// "localhost", not "127.0.0.1": the Next.js dev server blocks its scripts for other origins
const baseURL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL,
    // Use the installed Google Chrome instead of downloading a browser
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: `pnpm exec next dev --port ${E2E_PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    // Point the app at the test database; Next.js does not override variables already set
    env: { POSTGRES_DB: E2E_DATABASE },
  },
});
