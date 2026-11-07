// Editing a note in place and deleting it after confirmation

import { expect, test, type Page } from "@playwright/test";

// The page reacts to buttons and keys only after its scripts have loaded
async function openNewContactCard(page: Page, name: string) {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill(name);
  await page.getByRole("button", { name: "Сохранить контакт" }).click();
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function addNote(page: Page, body: string) {
  const count = await page.getByTestId("note").count();
  await page.getByRole("textbox", { name: "Новая заметка" }).fill(body);
  await page.getByRole("button", { name: "Сохранить заметку" }).click();
  await expect(page.getByTestId("note")).toHaveCount(count + 1);
}

function noteWith(page: Page, text: string) {
  return page.getByTestId("note").filter({ hasText: text });
}

test("edit a note: saved with Ctrl+Enter or the button, empty text is rejected, Esc and 'Отмена' change nothing", async ({
  page,
}) => {
  await openNewContactCard(page, `Правка заметок ${Date.now().toString(36)}`);
  await addNote(page, "Первая заметка");
  await addNote(page, "Вторая заметка");
  const datesBefore = await page.getByTestId("note").locator("time").allTextContents();

  // "Отмена" keeps the old text
  await noteWith(page, "Первая заметка").getByRole("button", { name: "Изменить заметку" }).click();
  const textbox = page.getByRole("textbox", { name: "Текст заметки" });
  await expect(textbox).toHaveValue("Первая заметка");
  await textbox.fill("Этот текст не сохранится");
  await page.getByRole("button", { name: "Отмена" }).click();
  await expect(textbox).toBeHidden();
  await expect(noteWith(page, "Первая заметка")).toHaveCount(1);

  // Esc does the same
  await noteWith(page, "Первая заметка").getByRole("button", { name: "Изменить заметку" }).click();
  await textbox.fill("И этот тоже");
  await textbox.press("Escape");
  await expect(textbox).toBeHidden();
  await expect(noteWith(page, "Первая заметка")).toHaveCount(1);

  // Empty text is an error, not a deletion; the form stays open
  await noteWith(page, "Первая заметка").getByRole("button", { name: "Изменить заметку" }).click();
  await textbox.fill("   ");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Заметка пустая")).toBeVisible();
  await expect(textbox).toBeVisible();

  // Saved with the button
  await textbox.fill("Первая заметка, исправленная");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(textbox).toBeHidden();
  await expect(noteWith(page, "Первая заметка, исправленная")).toHaveCount(1);

  // Saved with Ctrl+Enter
  await noteWith(page, "Вторая заметка").getByRole("button", { name: "Изменить заметку" }).click();
  await textbox.fill("Вторая заметка, исправленная");
  await textbox.press("Control+Enter");
  await expect(textbox).toBeHidden();
  await expect(noteWith(page, "Вторая заметка, исправленная")).toHaveCount(1);

  // After a reload: new texts, same dates and order, nothing added
  await page.reload();
  await expect(page.getByTestId("note")).toHaveText([
    /Вторая заметка, исправленная/,
    /Первая заметка, исправленная/,
  ]);
  expect(await page.getByTestId("note").locator("time").allTextContents()).toEqual(datesBefore);
});

test("delete a note: only after confirmation, other notes stay", async ({ page }) => {
  await openNewContactCard(page, `Удаление заметок ${Date.now().toString(36)}`);
  await addNote(page, "Эта заметка останется");
  await addNote(page, "Эта заметка удалится");

  // "Отмена" in the dialog keeps the note
  await noteWith(page, "Эта заметка удалится")
    .getByRole("button", { name: "Удалить заметку" })
    .click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Удалить заметку?");
  await expect(dialog).toContainText("«Эта заметка удалится»");
  await expect(dialog).toContainText("Отменить это нельзя");
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("note")).toHaveCount(2);

  // Confirming deletes only this note
  await noteWith(page, "Эта заметка удалится")
    .getByRole("button", { name: "Удалить заметку" })
    .click();
  await dialog.getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByTestId("note")).toHaveCount(1);
  await expect(noteWith(page, "Эта заметка останется")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 2 })).toContainText("1 заметка");

  await page.reload();
  await expect(page.getByTestId("note")).toHaveText([/Эта заметка останется/]);
});

test("saving a note deleted in another tab says it is not found", async ({ page }) => {
  await openNewContactCard(page, `Заметка в двух вкладках ${Date.now().toString(36)}`);
  await addNote(page, "Заметка, которую удалят в другой вкладке");
  await noteWith(page, "Заметка, которую удалят")
    .getByRole("button", { name: "Изменить заметку" })
    .click();
  await page.getByRole("textbox", { name: "Текст заметки" }).fill("Новый текст");

  const otherTab = await page.context().newPage();
  await otherTab.goto(page.url());
  await otherTab.getByRole("button", { name: "Удалить заметку" }).click();
  await otherTab.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(otherTab.getByTestId("note")).toHaveCount(0);
  await otherTab.close();

  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Заметка не найдена")).toBeVisible();
  // What was typed stays in the form
  await expect(page.getByRole("textbox", { name: "Текст заметки" })).toHaveValue("Новый текст");
});
