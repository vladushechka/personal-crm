// When saving fails, the error must not carry what was being saved: the server log keeps it.
// The app server's output goes to a file during the tests (playwright.config.ts)

import { readFileSync } from "node:fs";

import { expect, test } from "@playwright/test";
import { sql } from "drizzle-orm";

import { E2E_SERVER_LOG } from "./constants";
import { withTestDb } from "./test-db";

function serverLog() {
  return readFileSync(E2E_SERVER_LOG, "utf8");
}

test("a failed save shows an error, and neither the log nor the browser gets the note", async ({
  page,
}) => {
  // Latin letters too, so the check doesn't depend on how the log writes Cyrillic
  const marker = `secret-${Date.now().toString(36)}`;
  const note = `Секретная заметка ${marker}`;
  const constraint = "e2e_forbidden_note";
  await withTestDb((db) =>
    db.execute(sql.raw(`alter table notes add constraint ${constraint} check (body <> '${note}')`)),
  );

  try {
    const browserMessages: string[] = [];
    page.on("console", (message) => browserMessages.push(message.text()));
    page.on("pageerror", (error) => browserMessages.push(error.message));

    const name = `Сбой сохранения ${Date.now().toString(36)}`;
    await page.goto("/contacts/new");
    await page.getByRole("textbox", { name: "Имя" }).fill(name);
    await page.getByRole("button", { name: "Сохранить контакт" }).click();
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await page.waitForLoadState("networkidle");

    await page.getByRole("textbox", { name: "Новая заметка" }).fill(note);
    await page.getByRole("button", { name: "Сохранить заметку" }).click();
    await expect(page.getByText("Что-то пошло не так")).toBeVisible();

    // 23514 is the Postgres code of a failed check: the error did reach the log
    await expect.poll(serverLog).toContain("23514");
    expect(serverLog()).not.toContain(marker);
    expect(serverLog()).not.toContain(note);
    expect(browserMessages.join("\n")).not.toContain(marker);
  } finally {
    await withTestDb((db) =>
      db.execute(sql.raw(`alter table notes drop constraint ${constraint}`)),
    );
  }
});
