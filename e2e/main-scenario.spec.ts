// Success criteria from specs/01-продуктовая-идея.md, checked in a real browser

import { test as base, type Browser, expect } from "@playwright/test";

import { E2E_CONTACT_COUNT, E2E_STORAGE_STATE } from "./constants";

// "Another browser sees the same data" opens the app in Microsoft Edge. On GitHub's runners
// Edge takes 20-60 s to start (CI run 44652889083: 46 s to launch, then 10+ s for the first
// page), while the scenario itself takes about 5 s. So Edge starts here, once per worker and
// with its own time limit: its start no longer eats the 60 s of the test
const test = base.extend<object, { otherBrowser: Browser }>({
  otherBrowser: [
    async ({ playwright }, use) => {
      const startedAt = Date.now();
      const browser = await playwright.chromium.launch({ channel: "msedge" });
      // The first page right after the start is the slow one: open it here, not in the test
      await (await browser.newPage()).close();
      console.log(`Microsoft Edge started in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

      await use(browser);
      await browser.close();
    },
    { scope: "worker", timeout: 120_000 },
  ],
});

test("opening the app shows the list of all contacts", async ({ page }) => {
  await page.goto("/");

  const summary = page.getByText(/^\d+ контакт(а|ов)?$/);
  await expect(summary).toBeVisible();
  const total = Number((await summary.textContent())?.split(" ")[0]);

  expect(total).toBeGreaterThanOrEqual(E2E_CONTACT_COUNT);
  await expect(page.getByTestId("contact-row")).toHaveCount(total);
});

test("add a contact, find it by name, add a note; another browser sees the same data", async ({
  page,
  otherBrowser,
}) => {
  const uniqueId = Date.now().toString(36);
  const name = `Тестовый Контакт ${uniqueId}`;
  const note = `Договорились созвониться в пятницу (${uniqueId})`;

  // Add a contact -> it appears in the list
  await page.goto("/");
  await page.getByRole("link", { name: "Добавить контакт" }).first().click();
  await page.getByLabel("Имя").fill(name);
  await page.getByLabel("Кто это").fill("Проверяющий");
  await page.getByLabel("Откуда знакомы").fill("Автотест главного сценария");
  await page.getByLabel("Телефон").fill("+7 900 000-00-00");
  await page.getByLabel("Почта").fill("test@example.com");
  await page.getByRole("button", { name: "Сохранить контакт" }).click();

  await expect(page).toHaveURL(/\/\?added=\d+$/);
  const newRow = page.getByTestId("contact-row").filter({ hasText: name });
  await expect(newRow).toBeVisible();
  await expect(newRow).toContainText("Только что добавлен");

  // Find it by part of the name, in lower case and different word order
  await page.getByRole("searchbox", { name: "Поиск по имени" }).fill(`${uniqueId} контакт`);
  await expect(page).toHaveURL(/\?q=/);
  await expect(page.getByTestId("contact-row")).toHaveCount(1);
  await page.getByRole("link", { name }).click();

  // Open the card and add a note
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.getByLabel("Новая заметка").fill(note);
  await page.getByRole("button", { name: "Сохранить заметку" }).click();
  await expect(page.getByTestId("note").filter({ hasText: note })).toBeVisible();
  await expect(page.getByLabel("Новая заметка")).toHaveValue("");

  // The note is saved in the card: it is still there after a reload
  await page.reload();
  await expect(page.getByTestId("note").filter({ hasText: note })).toBeVisible();
  const cardUrl = page.url();

  // A different browser (Microsoft Edge) at the same address sees the same data.
  // The same person, signed in there too
  const otherPage = await otherBrowser.newPage({ storageState: E2E_STORAGE_STATE });
  try {
    await otherPage.goto(cardUrl);
    await expect(otherPage.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(otherPage.getByTestId("note").filter({ hasText: note })).toBeVisible();

    await otherPage.goto(new URL("/", cardUrl).toString());
    await expect(otherPage.getByTestId("contact-row").filter({ hasText: name })).toBeVisible();
  } finally {
    await otherPage.context().close();
  }
});

test("delete a contact from its card after confirming", async ({ page }) => {
  const name = `Удаляемый Контакт ${Date.now().toString(36)}`;

  await page.goto("/contacts/new");
  await page.getByLabel("Имя").fill(name);
  await page.getByRole("button", { name: "Сохранить контакт" }).click();
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  await page.getByRole("link", { name }).click();

  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.getByLabel("Новая заметка").fill("Заметка, которая удалится вместе с контактом");
  await page.getByRole("button", { name: "Сохранить заметку" }).click();
  await expect(page.getByTestId("note")).toHaveCount(1);
  const cardUrl = page.url();

  // "Cancel" keeps the contact
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(`Удалить контакт «${name}»?`);
  await expect(dialog).toContainText("Будут удалены карточка и 1 заметка");
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  // Confirming deletes it and returns to the list
  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await dialog.getByRole("button", { name: "Удалить" }).click();
  await expect(page).toHaveURL(/\/\?deleted=/);
  await expect(
    page.getByRole("status").filter({ hasText: `Контакт «${name}» удалён` }),
  ).toBeVisible();
  await expect(page.getByTestId("contact-row").filter({ hasText: name })).toHaveCount(0);

  await page.goto(cardUrl);
  await expect(page.getByText("Контакт не найден")).toBeVisible();
});

test("an unknown contact address shows a 'not found' page", async ({ page }) => {
  await page.goto("/contacts/999999999");
  await expect(page.getByText("Контакт не найден")).toBeVisible();
});
