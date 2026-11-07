// Fields of a database error that name the failure, never the data. Its "message" and "detail"
// can quote the row being saved
const safeFields = ["code", "table_name", "column_name", "constraint_name"] as const;

type QueryFailure = {
  query?: unknown;
  cause?: Record<string, unknown>;
};

// Keeps the database's error code, so a caller can tell a conflict from a failure
class SafeQueryError extends Error {
  code?: string;

  constructor(error: unknown) {
    const failure = (error ?? {}) as QueryFailure & Record<string, unknown>;
    const source = failure.cause ?? failure;
    const details = safeFields
      .filter((field) => typeof source[field] === "string")
      .map((field) => `${field}=${source[field]}`);
    // The query text has $1, $2 in place of values
    const query = typeof failure.query === "string" ? `\nquery: ${failure.query}` : "";

    super(`Database query failed: ${details.join(" ")}${query}`);
    this.code = typeof source.code === "string" ? source.code : undefined;
  }
}

// Drizzle puts a failed query's values into its error, and server logs print that: names, phones,
// note texts. Every query that sends text typed by the user goes through this function.
// It replaces any error, without "instanceof": each Next.js route bundles its own copy of Drizzle,
// so the error class of the shared connection may not be the one imported here
export async function safely<T>(query: PromiseLike<T>): Promise<T> {
  try {
    return await query;
  } catch (error) {
    // No "cause": logs would print the original error with its values too
    throw new SafeQueryError(error);
  }
}
