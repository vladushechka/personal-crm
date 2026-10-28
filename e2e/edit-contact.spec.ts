// Editing an existing contact: same fields and validation as when adding one

import { expect, test, type Page } from "@playwright/test";

// Next.js keeps recently visited pages in the document, hidden. getByLabel would also find
// fields of the hidden add form, getByRole looks only at what is on screen
function field(page: Page, label: string) {
  return page.getByRole("textbox", { name: label });
}

async function addContact(page: Page, fields: Record<string, string>) {
  await page.goto("/contacts/new");
  for (const [label, value] of Object.entries(fields)) {
    await field(page, label).fill(value);
  }
  await page.getByRole("button", { name: "Сохранить контакт" }).click();
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  await page.getByRole("link", { name: fields["Имя"] }).click();
  await expect(page.getByRole("heading", { level: 1, name: fields["Имя"] })).toBeVisible();
}

function detail(page: Page, label: string) {
  return page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
}

test("edit a contact: the form is prefilled, validated like on adding, and changes are saved", async ({
  page,
}) => {
  const uniqueId = Date.now().toString(36);
  const oldName = `Старое Имя ${uniqueId}`;
  const newName = `Новое Имя ${uniqueId}`;

  await addContact(page, {
    Имя: oldName,
    "Кто это": "Бывший коллега",
    "Откуда знакомы": "Работали в одной команде",
    Телефон: "+7 900 111-11-11",
    Почта: "old@example.com",
  });
  const cardUrl = page.url();

  // "Cancel" returns to the card and changes nothing
  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Изменить контакт" })).toBeVisible();
  await field(page, "Имя").fill("Это имя не сохранится");
  await page.getByRole("link", { name: "Отмена" }).click();
  await expect(page).toHaveURL(cardUrl);
  await expect(page.getByRole("heading", { level: 1, name: oldName })).toBeVisible();

  // The form shows the current values
  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(field(page, "Имя")).toHaveValue(oldName);
  await expect(field(page, "Кто это")).toHaveValue("Бывший коллега");
  await expect(field(page, "Откуда знакомы")).toHaveValue("Работали в одной команде");
  await expect(field(page, "Телефон")).toHaveValue("+7 900 111-11-11");
  await expect(field(page, "Почта")).toHaveValue("old@example.com");

  // Same validation as when adding; what was typed stays in the form
  await field(page, "Имя").fill("   ");
  await field(page, "Телефон").fill("1".repeat(51));
  await field(page, "Почта").fill("new@example");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByText("Укажите имя")).toBeVisible();
  await expect(page.getByText("Слишком длинно: не больше 50 символов")).toBeVisible();
  await expect(page.getByText("Похоже, в адресе почты опечатка")).toBeVisible();
  await expect(field(page, "Почта")).toHaveValue("new@example");
  await expect(field(page, "Кто это")).toHaveValue("Бывший коллега");

  // Fix the errors, change every field and clear the phone
  await field(page, "Имя").fill(newName);
  await field(page, "Кто это").fill("Друг");
  await field(page, "Откуда знакомы").fill("Познакомились в походе");
  await field(page, "Телефон").fill("");
  await field(page, "Почта").fill("new@example.com");
  await page.getByRole("button", { name: "Сохранить изменения" }).click();

  await expect(page).toHaveURL(`${cardUrl}?saved=1`);
  await expect(page.getByRole("status").filter({ hasText: "Изменения сохранены" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible();

  // Opening the form again shows the saved values, not the earlier draft
  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(field(page, "Имя")).toHaveValue(newName);
  await expect(field(page, "Телефон")).toHaveValue("");
  await expect(field(page, "Почта")).toHaveValue("new@example.com");
  await page.getByRole("link", { name: "Отмена" }).click();
  await expect(page).toHaveURL(cardUrl);

  // The changes are saved: they are still there after a reload
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: newName })).toBeVisible();
  await expect(page.getByText("Друг", { exact: true })).toBeVisible();
  await expect(detail(page, "Откуда знакомы")).toHaveText("Познакомились в походе");
  await expect(detail(page, "Телефон")).toHaveText("не указано");
  await expect(detail(page, "Почта")).toHaveText("new@example.com");

  // Search finds the contact by the new name, not by the old one.
  // Enter submits the search even if the page's scripts haven't loaded yet
  await page.goto("/");
  const search = page.getByRole("searchbox", { name: "Поиск по имени" });
  await search.fill(`новое ${uniqueId}`);
  await search.press("Enter");
  await expect(page).toHaveURL(/\?q=/);
  await expect(page.getByTestId("contact-row")).toHaveCount(1);
  await expect(page.getByTestId("contact-row")).toContainText(newName);
  await expect(page.getByTestId("contact-row")).toContainText("Друг · Познакомились в походе");

  await search.fill(`старое ${uniqueId}`);
  await search.press("Enter");
  await expect(page.getByText("Никого не нашли")).toBeVisible();
});

test("saving a contact deleted meanwhile in another tab shows 'not found'", async ({ page }) => {
  const name = `Удалят во время правки ${Date.now().toString(36)}`;

  await addContact(page, { Имя: name });
  const cardUrl = page.url();
  await page.getByRole("link", { name: "Изменить" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Изменить контакт" })).toBeVisible();
  await field(page, "Имя").fill(`${name} (изменено)`);

  const otherTab = await page.context().newPage();
  await otherTab.goto(cardUrl);
  await otherTab.getByRole("button", { name: "Удалить" }).click();
  await otherTab.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(otherTab).toHaveURL(/\/\?deleted=/);
  await otherTab.close();

  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page.getByText("Контакт не найден")).toBeVisible();
});

test("editing an unknown contact shows a 'not found' page", async ({ page }) => {
  await page.goto("/contacts/999999999/edit");
  await expect(page.getByText("Контакт не найден")).toBeVisible();
});
