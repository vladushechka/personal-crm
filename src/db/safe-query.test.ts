import { describe, expect, it } from "vitest";

import { safely } from "./safe-query";

// Shaped like Drizzle's error, but not its class: each Next.js route bundles its own copy of
// Drizzle, so the error of a shared connection can come from any of them
class ErrorFromAnotherBundle extends Error {
  query = 'insert into "contacts" ("name", "phone") values ($1, $2)';
  params = ["Анна Смирнова", "+7 900 123-45-67"];
  cause = {
    code: "23514",
    table_name: "contacts",
    constraint_name: "contacts_phone_check",
    message: "new row violates check constraint",
    detail: "Failing row contains (Анна Смирнова, +7 900 123-45-67)",
  };

  constructor() {
    super('Failed query: insert into "contacts"\nparams: Анна Смирнова,+7 900 123-45-67');
  }
}

async function failureOf(query: PromiseLike<unknown>) {
  return safely(query).then(
    () => expect.unreachable("the query should have failed"),
    (error: Error) => error,
  );
}

describe("safely", () => {
  it("returns what the query returns", async () => {
    await expect(safely(Promise.resolve([1, 2]))).resolves.toEqual([1, 2]);
  });

  it("drops the values from a failed query's error", async () => {
    const error = await failureOf(Promise.reject(new ErrorFromAnotherBundle()));

    const logged = JSON.stringify({ ...error, message: error.message, cause: error.cause });
    expect(logged).not.toContain("Анна");
    expect(logged).not.toContain("900");
    expect(error.cause).toBeUndefined();
  });

  it("keeps what names the failure: code, table, constraint and the query with placeholders", async () => {
    const error = await failureOf(Promise.reject(new ErrorFromAnotherBundle()));

    expect(error.message).toContain("code=23514");
    expect(error.message).toContain("table_name=contacts");
    expect(error.message).toContain("constraint_name=contacts_phone_check");
    expect(error.message).toContain("values ($1, $2)");
  });

  it("keeps the code for the caller to tell a conflict from a failure", async () => {
    const error = await failureOf(Promise.reject(new ErrorFromAnotherBundle()));

    expect((error as Error & { code?: string }).code).toBe("23514");
  });

  it("drops the text of an error it knows nothing about", async () => {
    const error = await failureOf(Promise.reject(new Error("Анна Смирнова")));

    expect(error.message).not.toContain("Анна");
  });

  it("survives a failure that isn't an error object", async () => {
    await expect(failureOf(Promise.reject(undefined))).resolves.toBeInstanceOf(Error);
    await expect(failureOf(Promise.reject("Анна Смирнова"))).resolves.toBeInstanceOf(Error);
  });
});
