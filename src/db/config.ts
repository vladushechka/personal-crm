// Database connection settings, read from environment variables (.env).
// Shared by the app, drizzle-kit, the seed script and end-to-end tests.

export type DatabaseConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
};

// Loads .env into process.env for scripts that run outside Next.js
// (Next.js loads .env by itself). Variables already set in the shell win.
export function loadEnvFile(path = ".env") {
  try {
    process.loadEnvFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Environment variable ${name} is not set. Copy .env.example to .env and fill in the values.`,
    );
  }
  return value;
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    // Locally docker-compose.yml publishes Postgres on 127.0.0.1 only;
    // on the server the app container reaches the "db" container by name
    host: process.env.POSTGRES_HOST || "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: requireEnv("POSTGRES_USER"),
    password: requireEnv("POSTGRES_PASSWORD"),
    database: requireEnv("POSTGRES_DB"),
  };
}
