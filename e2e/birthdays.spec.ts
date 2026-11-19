// Birthdays: the date in the contact form and card, the "Скоро день рождения" block on the list.
// Tests in this file run in order. Dates are counted from today's Moscow date, the same way the
// app does; calendar edge cases (new year, 29 February, midnight in Moscow) are unit tests

import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { findOrCreateUser } from "../scripts/seed-db";
import { contactGroups, contacts, groups } from "../src/db/schema";
import { monthNamesGenitive, moscowToday, type CalendarDate } from "../src/lib/birthdays";

import { e2eOwnerId, withTestDb } from "./test-db";

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
  return id;
}

async function openEditForm(page: Page, contactId: number) {
  await page.goto(`/contacts/${contactId}/edit`);
  await expect(page.getByRole("heading", { level: 1, name: "Изменить контакт" })).toBeVisible();
  // The lists open only after the page's scripts have loaded
  await page.waitForLoadState("networkidle");
}

function dayField(page: Page) {
  return page.getByRole("combobox", { name: "День", exact: true });
}

function monthField(page: Page) {
  return page.getByRole("combobox", { name: "Месяц", exact: true });
}

// What a list shows as chosen, without the arrow of the field
function chosen(field: ReturnType<typeof dayField>) {
  return field.locator("[data-slot=select-value]");
}

function yearField(page: Page) {
  return page.getByRole("textbox", { name: "Год", exact: true });
}

async function choose(page: Page, field: ReturnType<typeof dayField>, option: string) {
  await field.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
}

// Fills the three parts of the birthday; "—" clears a list
async function fillBirthday(
  page: Page,
  { day, month, year }: { day?: string; month?: string; year?: string },
) {
  if (day !== undefined) await choose(page, dayField(page), day);
  if (month !== undefined) await choose(page, monthField(page), month);
  if (year !== undefined) await yearField(page).fill(year);
}

async function saveChanges(page: Page, contactId: number) {
  await page.getByRole("button", { name: "Сохранить изменения" }).click();
  await expect(page).toHaveURL(new RegExp(`/contacts/${contactId}\\?saved=1$`));
}

function detail(page: Page, label: string) {
  return page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
}

async function setBirthdayInDb(
  contactId: number,
  birthday: { day: number; month: number; year: number | null } | null,
) {
  await withTestDb((db) =>
    db
      .update(contacts)
      .set({
        birthdayDay: birthday?.day ?? null,
        birthdayMonth: birthday?.month ?? null,
        birthdayYear: birthday?.year ?? null,
      })
      .where(eq(contacts.id, contactId)),
  );
}

test.describe("the birthday in the contact form and card", () => {
  test("a date with a year", async ({ page }) => {
    const id = await addContact(page, uniqueName("С годом"));
    await expect(detail(page, "День рождения")).toHaveText("не указано");

    await openEditForm(page, id);
    await fillBirthday(page, { day: "24", month: "ноября", year: "1990" });
    await saveChanges(page, id);
    await expect(detail(page, "День рождения")).toHaveText("24 ноября 1990 г.");
  });

  test("a date without a year", async ({ page }) => {
    const id = await addContact(page, uniqueName("Без года"));
    await openEditForm(page, id);
    await fillBirthday(page, { day: "24", month: "ноября" });
    await saveChanges(page, id);
    await expect(detail(page, "День рождения")).toHaveText("24 ноября");
  });

  test("a new contact with a birthday", async ({ page }) => {
    const name = uniqueName("Новый с датой");
    await page.goto("/contacts/new");
    await page.waitForLoadState("networkidle");
    await page.getByRole("textbox", { name: "Имя" }).fill(name);
    await fillBirthday(page, { day: "5", month: "марта", year: "1985" });
    await page.getByRole("button", { name: "Сохранить контакт" }).click();
    await expect(page).toHaveURL(/\/\?added=\d+$/);

    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(detail(page, "День рождения")).toHaveText("5 марта 1985 г.");
  });

  test("the edit form shows the saved date", async ({ page }) => {
    const id = await addContact(page, uniqueName("Форма на правку"));
    await setBirthdayInDb(id, { day: 24, month: 11, year: null });

    await openEditForm(page, id);
    await expect(chosen(dayField(page))).toHaveText("24");
    await expect(chosen(monthField(page))).toHaveText("ноября");
    await expect(yearField(page)).toHaveValue("");
  });

  test("clearing the three parts removes the date", async ({ page }) => {
    const id = await addContact(page, uniqueName("Убрать дату"));
    await setBirthdayInDb(id, { day: 24, month: 11, year: 1990 });

    await openEditForm(page, id);
    await expect(yearField(page)).toHaveValue("1990");
    await fillBirthday(page, { day: "—", month: "—", year: "" });
    await saveChanges(page, id);
    await expect(detail(page, "День рождения")).toHaveText("не указано");
  });

  test("a wrong date is not saved, and the form keeps what was typed", async ({ page }) => {
    const name = uniqueName("Неверная дата");
    const id = await addContact(page, name);
    await openEditForm(page, id);
    // The error is under the birthday fields
    const error = page.getByRole("group", { name: "День рождения" }).getByRole("alert");
    const submit = page.getByRole("button", { name: "Сохранить изменения" });

    // Only the day
    await page.getByRole("textbox", { name: "Кто это" }).fill("Сосед по даче");
    await fillBirthday(page, { day: "24" });
    await submit.click();
    await expect(error).toHaveText("Укажите день и месяц");
    await expect(page).toHaveURL(new RegExp(`/contacts/${id}/edit$`));
    await expect(chosen(dayField(page))).toHaveText("24");
    await expect(page.getByRole("textbox", { name: "Кто это" })).toHaveValue("Сосед по даче");

    // A date that does not exist
    await fillBirthday(page, { day: "31", month: "апреля" });
    await submit.click();
    await expect(error).toHaveText("Такой даты нет");
    await expect(chosen(dayField(page))).toHaveText("31");
    await expect(chosen(monthField(page))).toHaveText("апреля");

    await fillBirthday(page, { day: "29", month: "февраля", year: "2023" });
    await submit.click();
    await expect(error).toHaveText("Такой даты нет");
    await expect(yearField(page)).toHaveValue("2023");

    // In the future
    const nextYear = String(moscowToday(new Date()).year + 1);
    await fillBirthday(page, { day: "1", month: "января", year: nextYear });
    await submit.click();
    await expect(error).toHaveText("Дата рождения в будущем");

    // A year too early or not a number
    await fillBirthday(page, { year: "1850" });
    await submit.click();
    await expect(error).toHaveText("Год — четыре цифры, от 1900");
    await fillBirthday(page, { year: "19ab" });
    await submit.click();
    await expect(error).toHaveText("Год — четыре цифры, от 1900");
    await expect(yearField(page)).toHaveValue("19ab");

    // Nothing was saved
    await page.goto(`/contacts/${id}`);
    await expect(detail(page, "День рождения")).toHaveText("не указано");
    await expect(page.getByText("Сосед по даче")).toHaveCount(0);
  });

  test("on a phone the three parts fit in one row, as tall as the other fields", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    const id = await addContact(page, uniqueName("На телефоне"));
    await openEditForm(page, id);

    const boxes = await Promise.all(
      [dayField(page), monthField(page), yearField(page)].map((field) => field.boundingBox()),
    );
    const [day, month, year] = boxes.map((box) => box!);
    expect(Math.abs(day.y - month.y)).toBeLessThan(2);
    expect(Math.abs(day.y - year.y)).toBeLessThan(2);
    const name = (await page.getByRole("textbox", { name: "Имя" }).boundingBox())!;
    for (const part of [day, month, year]) expect(part.height).toBeCloseTo(name.height, 0);
    expect(year.x + year.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
  });
});

// Today in Moscow plus some days: -1 is yesterday
function daysFromToday(days: number): CalendarDate {
  const today = moscowToday(new Date());
  const date = new Date(Date.UTC(today.year, today.month - 1, today.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

// "24 ноября"
function dayAndMonth(date: CalendarDate) {
  return `${date.day} ${monthNamesGenitive[date.month - 1]}`;
}

// The block's rows depend on every contact of the owner: tests that count them start clean
async function clearAllBirthdays() {
  const ownerId = await e2eOwnerId();
  await withTestDb((db) =>
    db
      .update(contacts)
      .set({ birthdayDay: null, birthdayMonth: null, birthdayYear: null })
      .where(eq(contacts.ownerId, ownerId)),
  );
}

// Adds contacts with birthdays straight to the database; returns their ids in the same order
async function insertWithBirthdays(
  people: { name: string; date: CalendarDate; birthYear?: number }[],
  ownerId?: string,
) {
  const owner = ownerId ?? (await e2eOwnerId());
  const rows = await withTestDb((db) =>
    db
      .insert(contacts)
      .values(
        people.map(({ name, date, birthYear }) => ({
          ownerId: owner,
          name,
          birthdayDay: date.day,
          birthdayMonth: date.month,
          birthdayYear: birthYear ?? null,
        })),
      )
      .returning({ id: contacts.id }),
  );
  return rows.map(({ id }) => id);
}

function birthdaysHeading(page: Page) {
  return page.getByRole("heading", { name: "Скоро день рождения" });
}

// Opens the list and shows the whole block; returns its rows
async function openBirthdays(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  const showAll = page.getByTestId("birthdays").getByRole("button", { name: /^Показать всех/ });
  if (await showAll.isVisible()) await showAll.click();
  return page.getByTestId("birthdays-row");
}

async function rowNames(page: Page) {
  return (await openBirthdays(page)).locator("span:first-child").allTextContents();
}

test.describe("the «Скоро день рождения» block", () => {
  test("there is no block while nobody has a birthday in the next 7 days", async ({ page }) => {
    await clearAllBirthdays();
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
    await expect(page.getByTestId("contact-row").first()).toBeVisible();
    await expect(birthdaysHeading(page)).toHaveCount(0);
  });

  test("8 days away and yesterday are not in the block", async ({ page }) => {
    await clearAllBirthdays();
    await insertWithBirthdays([
      { name: uniqueName("Через 8 дней"), date: daysFromToday(8) },
      { name: uniqueName("Вчера"), date: daysFromToday(-1) },
    ]);
    await page.goto("/");
    await expect(page.getByTestId("contact-row").first()).toBeVisible();
    await expect(birthdaysHeading(page)).toHaveCount(0);
  });

  test("the nearest first, on the same day by name; exactly a week away is in the block", async ({
    page,
  }) => {
    const prefix = uniqueName("Порядок");
    const [inFive, tomorrow, sameDayB, sameDayA, inWeek] = [
      `${prefix} А через 5`,
      `${prefix} Б завтра`,
      `${prefix} Ярослав через 3`,
      `${prefix} Анна через 3`,
      `${prefix} через неделю`,
    ];
    await insertWithBirthdays([
      { name: inFive, date: daysFromToday(5) },
      { name: tomorrow, date: daysFromToday(1) },
      { name: sameDayB, date: daysFromToday(3) },
      { name: sameDayA, date: daysFromToday(3) },
      { name: inWeek, date: daysFromToday(7) },
    ]);

    const names = (await rowNames(page)).filter((name) => name.startsWith(prefix));
    expect(names).toEqual([tomorrow, sameDayA, sameDayB, inFive, inWeek]);
  });

  test("a row says when and how old: today, tomorrow, in a few days", async ({ page }) => {
    const today = daysFromToday(0);
    const tomorrow = daysFromToday(1);
    const inSix = daysFromToday(6);
    const [todayName, tomorrowName, inSixName] = [
      uniqueName("Сегодня"),
      uniqueName("Завтра"),
      uniqueName("Через шесть"),
    ];
    await insertWithBirthdays([
      { name: todayName, date: today, birthYear: today.year - 35 },
      { name: tomorrowName, date: tomorrow },
      { name: inSixName, date: inSix, birthYear: inSix.year - 36 },
    ]);

    const rows = await openBirthdays(page);
    await expect(rows.filter({ hasText: todayName })).toContainText(
      `Сегодня, ${dayAndMonth(today)} · исполняется 35`,
    );
    await expect(rows.filter({ hasText: tomorrowName })).toContainText(
      `Завтра, ${dayAndMonth(tomorrow)}`,
    );
    await expect(rows.filter({ hasText: tomorrowName })).not.toContainText("исполнится");
    await expect(rows.filter({ hasText: inSixName })).toContainText(
      `${dayAndMonth(inSix)}, через 6 дней · исполнится 36`,
    );
  });

  test("a row leads to the contact's card", async ({ page }) => {
    const name = uniqueName("Ссылка");
    await insertWithBirthdays([{ name, date: daysFromToday(2) }]);
    const rows = await openBirthdays(page);
    await rows.filter({ hasText: name }).getByRole("link").click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  });

  test("the block is hidden while searching or with a group chosen", async ({ page }) => {
    const name = uniqueName("Поиск и группа");
    const [id] = await insertWithBirthdays([{ name, date: daysFromToday(1) }]);
    await expect((await openBirthdays(page)).filter({ hasText: name })).toHaveCount(1);

    await page.goto(`/?q=${encodeURIComponent(name)}`);
    await expect(page.getByText("Найдено: 1 из")).toBeVisible();
    await expect(birthdaysHeading(page)).toHaveCount(0);

    const ownerId = await e2eOwnerId();
    const groupId = await withTestDb(async (db) => {
      const [group] = await db
        .insert(groups)
        .values({ ownerId, name: uniqueName("Именинники") })
        .returning({ id: groups.id });
      await db.insert(contactGroups).values({ contactId: id, groupId: group.id });
      return group.id;
    });
    try {
      await page.goto(`/?group=${groupId}`);
      await expect(page.getByTestId("contact-row").filter({ hasText: name })).toBeVisible();
      await expect(birthdaysHeading(page)).toHaveCount(0);
    } finally {
      // groups.spec.ts starts with no groups
      await withTestDb((db) => db.delete(groups).where(eq(groups.id, groupId)));
    }
  });

  test("another user's contacts are not in the block", async ({ page }) => {
    const otherOwner = await withTestDb((db) =>
      findOrCreateUser(db, `birthdays-other-${Date.now().toString(36)}@example.com`),
    );
    const name = uniqueName("Чужой именинник");
    await insertWithBirthdays([{ name, date: daysFromToday(1) }], otherOwner);
    // Someone of the owner's own, so the block is there
    await insertWithBirthdays([{ name: uniqueName("Свой именинник"), date: daysFromToday(1) }]);

    const rows = await openBirthdays(page);
    await expect(rows.first()).toBeVisible();
    await expect(rows.filter({ hasText: name })).toHaveCount(0);
  });

  test("a cleared birthday leaves the block", async ({ page }) => {
    const name = uniqueName("Убрать из блока");
    const [id] = await insertWithBirthdays([{ name, date: daysFromToday(1), birthYear: 1990 }]);
    await expect((await openBirthdays(page)).filter({ hasText: name })).toHaveCount(1);

    await openEditForm(page, id);
    await fillBirthday(page, { day: "—", month: "—", year: "" });
    await saveChanges(page, id);
    await expect(detail(page, "День рождения")).toHaveText("не указано");
    await expect((await openBirthdays(page)).filter({ hasText: name })).toHaveCount(0);
  });

  test("the block shows five and opens the rest in the same order", async ({ page }) => {
    await clearAllBirthdays();
    const prefix = uniqueName("Много именинников");
    const names = Array.from({ length: 7 }, (_, index) => `${prefix} ${index + 1}`);
    await insertWithBirthdays(names.map((name, index) => ({ name, date: daysFromToday(index) })));

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const block = page.getByTestId("birthdays");
    await expect(block.getByTestId("birthdays-row")).toHaveCount(5);
    await expect(block.locator("li span:first-child")).toHaveText(names.slice(0, 5));
    await block.getByRole("button", { name: "Показать всех (7)" }).click();
    await expect(block.getByTestId("birthdays-row")).toHaveCount(7);
    await expect(block.locator("li span:first-child")).toHaveText(names);
  });

  test("the birthdays block is above «Пора связаться»", async ({ page }) => {
    await insertWithBirthdays([{ name: uniqueName("Над блоком"), date: daysFromToday(1) }]);
    const ownerId = await e2eOwnerId();
    const [overdue] = await withTestDb((db) =>
      db
        .insert(contacts)
        .values({
          ownerId,
          name: uniqueName("Пора связаться"),
          keepInTouchFrequency: "week",
          keepInTouchSince: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        })
        .returning({ id: contacts.id }),
    );

    try {
      await page.goto("/");
      const birthdays = page.getByTestId("birthdays");
      const reachOut = page.getByTestId("reach-out");
      await expect(birthdays).toBeVisible();
      await expect(reachOut).toBeVisible();
      expect((await birthdays.boundingBox())!.y).toBeLessThan((await reachOut.boundingBox())!.y);
    } finally {
      // keep-in-touch.spec.ts starts with nobody due
      await withTestDb((db) => db.delete(contacts).where(eq(contacts.id, overdue.id)));
    }
  });
});
