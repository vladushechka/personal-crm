import { defineConfig } from "@playwright/test";

import { E2E_DATABASE, E2E_PORT, E2E_SERVER_LOG } from "./e2e/constants";

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
    // CI runs a production build made before the tests (pnpm build): the same code as on the
    // server, and faster than the dev server. Locally the dev server needs no build.
    // The server's output goes to a file, where tests read the log
    command: `${
      process.env.CI
        ? `pnpm exec next start -H localhost --port ${E2E_PORT}`
        : `pnpm exec next dev --port ${E2E_PORT}`
    } > "${E2E_SERVER_LOG}" 2>&1`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    // Point the app at the test database; Next.js does not override variables already set
    env: { POSTGRES_DB: E2E_DATABASE },
  },
});
