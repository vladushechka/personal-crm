import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Fast tests of code without a database or a browser. End-to-end tests are in e2e/
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
