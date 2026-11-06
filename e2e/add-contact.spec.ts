// Mistakes while adding a contact, step 2 of the main scenario in specs/01-продуктовая-идея.md

import { expect, test, type Page } from "@playwright/test";

// Next.js keeps recently visited pages in the document, hidden. getByRole looks only at what is
// on screen
function field(page: Page, label: string) {
  return page.getByRole("textbox", { name: label });
}

function detail(page: Page, label: string) {
  return page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
}

function save(page: Page) {
  return page.getByRole("button", { name: "Сохранить контакт" }).click();
}

async function contactCount(page: Page) {
  await page.goto("/");
  const summary = page.getByText(/^\d+ контакт(а|ов)?$/);
  await expect(summary).toBeVisible();
  return Number((await summary.textContent())?.split(" ")[0]);
}

test("mistakes on adding: the form says what to fix, keeps what was typed and saves nothing", async ({
  page,
}) => {
  const name = `Ошибка Добавления ${Date.now().toString(36)}`;
  const countBefore = await contactCount(page);

  await page.goto("/contacts/new");
  await field(page, "Кто это").fill("Сосед по даче");
  await field(page, "Откуда знакомы").fill("Познакомились на рынке");

  // An empty name: the browser itself doesn't send the form
  await save(page);
  await expect(page).toHaveURL(/\/contacts\/new$/);
  await expect(field(page, "Кто это")).toHaveValue("Сосед по даче");

  // Spaces instead of a name, a phone that is too long, a typo in the address
  await field(page, "Имя").fill("   ");
  await field(page, "Телефон").fill("1".repeat(51));
  await field(page, "Почта").fill("sosed@example");
  await save(page);
  await expect(page.getByText("Укажите имя")).toBeVisible();
  await expect(page.getByText("Слишком длинно: не больше 50 символов")).toBeVisible();
  await expect(page.getByText("Похоже, в адресе почты опечатка")).toBeVisible();

  // Still the form, with everything that was typed
  await expect(page).toHaveURL(/\/contacts\/new$/);
  await expect(field(page, "Кто это")).toHaveValue("Сосед по даче");
  await expect(field(page, "Откуда знакомы")).toHaveValue("Познакомились на рынке");
  await expect(field(page, "Телефон")).toHaveValue("1".repeat(51));
  await expect(field(page, "Почта")).toHaveValue("sosed@example");

  // Fixing the mistakes saves the contact
  await field(page, "Имя").fill(name);
  await field(page, "Телефон").fill("+7 900 222-33-44");
  await field(page, "Почта").fill("sosed@example.com");
  await save(page);
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  await expect(page.getByTestId("contact-row").filter({ hasText: name })).toHaveCount(1);

  // One contact more: the attempts with mistakes saved nothing
  expect(await contactCount(page)).toBe(countBefore + 1);

  // The card has what was fixed and what was kept
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText("Сосед по даче", { exact: true })).toBeVisible();
  await expect(detail(page, "Откуда знакомы")).toHaveText("Познакомились на рынке");
  await expect(detail(page, "Телефон")).toHaveText("+7 900 222-33-44");
  await expect(detail(page, "Почта")).toHaveText("sosed@example.com");
});
