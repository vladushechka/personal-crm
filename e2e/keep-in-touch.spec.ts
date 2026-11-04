// "Как часто общаться" in the contact card and the "Пора связаться" block on the list.
// Tests in this file run in order: the first one needs a database where nobody is due yet

import { expect, test, type Page } from "@playwright/test";
import { eq, sql } from "drizzle-orm";

import { contacts, notes } from "../src/db/schema";

import { withTestDb } from "./test-db";

function uniqueName(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}

// Leaves the page on the new contact's card; returns the contact id
async function addContact(page: Page, name: string) {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill(name);
  await page.getByRole("button", { name: "Сохранить контакт" }).click();
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  const id = Number(new URL(page.url()).searchParams.get("added"));
  await page.goto(`/contacts/${id}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  // The select saves on change only after the page's scripts have loaded
  await page.waitForLoadState("networkidle");
  return id;
}

function frequencySelect(page: Page) {
  return page.getByRole("combobox", { name: "Как часто общаться" });
}

async function setFrequency(page: Page, label: string) {
  const select = frequencySelect(page);
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    select.selectOption({ label }),
  ]);
  await expect(select).toBeEnabled();
}

async function addNote(page: Page, body: string) {
  const count = await page.getByTestId("note").count();
  await page.getByRole("textbox", { name: "Новая заметка" }).fill(body);
  await page.getByRole("button", { name: "Сохранить заметку" }).click();
  await expect(page.getByTestId("note")).toHaveCount(count + 1);
}

// Opens the list and shows the whole block, so a contact further down is visible too
async function openReachOut(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
  const showAll = page.getByRole("button", { name: /^Показать всех/ });
  if (await showAll.isVisible()) await showAll.click();
  return page.getByTestId("reach-out-row");
}

async function moveNotesBack(contactId: number, interval: string) {
  await withTestDb((db) =>
    db
      .update(notes)
      .set({ createdAt: sql`now() - ${interval}::interval` })
      .where(eq(notes.contactId, contactId)),
  );
}

async function moveFrequencyChoiceBack(contactId: number, interval: string) {
  await withTestDb((db) =>
    db
      .update(contacts)
      .set({ keepInTouchSince: sql`now() - ${interval}::interval` })
      .where(eq(contacts.id, contactId)),
  );
}

test("there is no block while nobody is due", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
  await expect(page.getByTestId("contact-row").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Пора связаться" })).toHaveCount(0);
});

test("the frequency is saved on choosing it and 'Не задано' clears it", async ({ page }) => {
  await addContact(page, uniqueName("Частота"));
  await expect(frequencySelect(page)).toHaveValue("");

  await setFrequency(page, "Раз в месяц");
  await page.reload();
  await expect(frequencySelect(page)).toHaveValue("month");

  await setFrequency(page, "Не задано");
  await page.reload();
  await expect(frequencySelect(page)).toHaveValue("");
});

test("changing the frequency of a contact deleted in another tab says it is not found", async ({
  page,
}) => {
  await addContact(page, uniqueName("Частота удалённого"));

  const otherTab = await page.context().newPage();
  await otherTab.goto(page.url());
  await otherTab.getByRole("button", { name: "Удалить", exact: true }).click();
  await otherTab.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(otherTab).toHaveURL(/\/\?deleted=/);
  await otherTab.close();

  await setFrequency(page, "Раз в неделю");
  await expect(page.getByRole("alert").filter({ hasText: "Контакт не найден" })).toBeVisible();
});

test("a new note restarts the countdown; editing an old one doesn't; deleting the latest brings it back", async ({
  page,
}) => {
  const name = uniqueName("Давно не общались");
  const id = await addContact(page, name);
  await addNote(page, "Старый разговор");
  await moveNotesBack(id, "2 months");
  await page.reload();

  // An old note: in the block right after choosing the frequency
  await setFrequency(page, "Раз в месяц");
  let row = (await openReachOut(page)).filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Раз в месяц · последняя заметка");

  // Editing the old note is not a conversation
  await row.getByRole("link").click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Изменить заметку" }).click();
  await page.getByRole("textbox", { name: "Текст заметки" }).fill("Старый разговор, исправленный");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Текст заметки" })).toBeHidden();
  row = (await openReachOut(page)).filter({ hasText: name });
  await expect(row).toHaveCount(1);

  // A new note restarts the countdown
  await page.goto(`/contacts/${id}`);
  await page.waitForLoadState("networkidle");
  await addNote(page, "Только что поговорили");
  await expect((await openReachOut(page)).filter({ hasText: name })).toHaveCount(0);

  // Deleting the new note: the old one counts again
  await page.goto(`/contacts/${id}`);
  await page.waitForLoadState("networkidle");
  await page
    .getByTestId("note")
    .filter({ hasText: "Только что поговорили" })
    .getByRole("button", { name: "Удалить заметку" })
    .click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(page.getByTestId("note")).toHaveCount(1);
  await expect((await openReachOut(page)).filter({ hasText: name })).toHaveCount(1);
});

test("without notes the countdown starts when the frequency is chosen, and again when it changes", async ({
  page,
}) => {
  const name = uniqueName("Без заметок");
  const id = await addContact(page, name);

  await setFrequency(page, "Раз в неделю");
  await expect((await openReachOut(page)).filter({ hasText: name })).toHaveCount(0);

  await moveFrequencyChoiceBack(id, "8 days");
  const row = (await openReachOut(page)).filter({ hasText: name });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Раз в неделю · заметок нет, частота задана");

  await page.goto(`/contacts/${id}`);
  await page.waitForLoadState("networkidle");
  await setFrequency(page, "Раз в месяц");
  await expect((await openReachOut(page)).filter({ hasText: name })).toHaveCount(0);
});

test("the most overdue are on top, and the block is hidden while searching", async ({ page }) => {
  // 14 days past "once a week" and about 60 days past "once a year"
  const weekly = uniqueName("Еженедельный");
  const weeklyId = await addContact(page, weekly);
  await addNote(page, "Три недели назад");
  await moveNotesBack(weeklyId, "21 days");
  await setFrequency(page, "Раз в неделю");

  const yearly = uniqueName("Ежегодный");
  const yearlyId = await addContact(page, yearly);
  await addNote(page, "Год и два месяца назад");
  await moveNotesBack(yearlyId, "14 months");
  await setFrequency(page, "Раз в год");

  const names = await (await openReachOut(page)).locator("span:first-child").allTextContents();
  expect(names.indexOf(yearly)).toBeGreaterThanOrEqual(0);
  expect(names.indexOf(yearly)).toBeLessThan(names.indexOf(weekly));

  await page.goto(`/?q=${encodeURIComponent(yearly)}`);
  await expect(page.getByText("Найдено: 1 из")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Пора связаться" })).toHaveCount(0);
});

test("the block shows five people and opens the rest with 'Показать всех'", async ({ page }) => {
  await withTestDb((db) =>
    db.insert(contacts).values(
      Array.from({ length: 6 }, (_, index) => ({
        name: uniqueName(`Много просроченных ${index + 1}`),
        keepInTouchFrequency: "week" as const,
        keepInTouchSince: sql`now() - interval '30 days'`,
      })),
    ),
  );

  await page.goto("/");
  const rows = page.getByTestId("reach-out-row");
  await expect(rows).toHaveCount(5);
  const showAll = page.getByRole("button", { name: /^Показать всех \(\d+\)$/ });
  const total = Number((await showAll.textContent())?.match(/\d+/)?.[0]);
  expect(total).toBeGreaterThanOrEqual(6);

  await showAll.click();
  await expect(rows).toHaveCount(total);
  await expect(showAll).toBeHidden();
});
