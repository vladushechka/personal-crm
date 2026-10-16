import { defineConfig } from "drizzle-kit";

import { getDatabaseConfig, loadEnvFile } from "./src/db/config";

loadEnvFile();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { ...getDatabaseConfig(), ssl: false },
});
