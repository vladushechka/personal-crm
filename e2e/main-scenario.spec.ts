// Success criteria from specs/01-продуктовая-идея.md, checked in a real browser

import { chromium, expect, test } from "@playwright/test";

import { E2E_CONTACT_COUNT } from "./constants";

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

  // A different browser (Microsoft Edge) at the same address sees the same data
  const otherBrowser = await chromium.launch({ channel: "msedge" });
  try {
    const otherPage = await otherBrowser.newPage();
    await otherPage.goto(cardUrl);
    await expect(otherPage.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(otherPage.getByTestId("note").filter({ hasText: note })).toBeVisible();

    await otherPage.goto(new URL("/", cardUrl).toString());
    await expect(otherPage.getByTestId("contact-row").filter({ hasText: name })).toBeVisible();
  } finally {
    await otherBrowser.close();
  }
});

test("an unknown contact address shows a 'not found' page", async ({ page }) => {
  await page.goto("/contacts/999999999");
  await expect(page.getByText("Контакт не найден")).toBeVisible();
});
