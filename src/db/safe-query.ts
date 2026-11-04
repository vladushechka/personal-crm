import { DrizzleQueryError } from "drizzle-orm";

// Fields of a Postgres error that name the failure, never the data. Its "message" and "detail"
// can quote the row being saved
const safeFields = ["code", "table_name", "column_name", "constraint_name"] as const;

function describeFailure(error: DrizzleQueryError) {
  const cause = error.cause as Partial<Record<(typeof safeFields)[number], string>> | undefined;
  const details = safeFields
    .filter((field) => cause?.[field])
    .map((field) => `${field}=${cause?.[field]}`);
  // The query text has $1, $2 in place of values
  return `Database query failed: ${details.join(" ")}\nquery: ${error.query}`;
}

// Drizzle puts a failed query's values into its error, and server logs print that: names, phones,
// note texts. Every query that sends text typed by the user goes through this function
export async function safely<T>(query: PromiseLike<T>): Promise<T> {
  try {
    return await query;
  } catch (error) {
    // No "cause": logs would print the Postgres error with its "detail" too
    if (error instanceof DrizzleQueryError) throw new Error(describeFailure(error));
    throw error;
  }
}
