// When saving fails, the error must not carry what was being saved: server logs keep it.
// The dev server passes the error's text on to the browser, so the test reads it there

import { expect, test } from "@playwright/test";
import { sql } from "drizzle-orm";

import { withTestDb } from "./test-db";

test("a failed save shows an error, and the error doesn't contain the note", async ({ page }) => {
  const note = `Секретная заметка ${Date.now().toString(36)}`;
  const constraint = "e2e_forbidden_note";
  await withTestDb((db) =>
    db.execute(
      sql.raw(`alter table notes add constraint ${constraint} check (body <> '${note}')`),
    ),
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

    const errorText = browserMessages.join("\n");
    // 23514 is the Postgres code of a failed check: the error did reach the browser
    expect(errorText).toContain("23514");
    expect(errorText).not.toContain(note);
  } finally {
    await withTestDb((db) =>
      db.execute(sql.raw(`alter table notes drop constraint ${constraint}`)),
    );
  }
});
