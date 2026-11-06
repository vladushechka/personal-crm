// Groups of contacts: in the card, on the list and on the "Группы" page.
// Tests in this file run in order: the first one needs a database without groups

import { expect, test, type Page } from "@playwright/test";
import { count, eq, sql } from "drizzle-orm";

import { contactGroups, contacts, groups } from "../src/db/schema";

import { withTestDb } from "./test-db";

function unique(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}

// Leaves the page on the new contact's card; returns the contact id
async function addContact(page: Page, name: string) {
  await page.goto("/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill(name);
  await page.getByRole("button", { name: "Сохранить контакт" }).click();
  await expect(page).toHaveURL(/\/\?added=\d+$/);
  const id = Number(new URL(page.url()).searchParams.get("added"));
  await openCard(page, id, name);
  return id;
}

// The buttons in the card work only after the page's scripts have loaded
async function openCard(page: Page, id: number, name?: string) {
  await page.goto(`/contacts/${id}`);
  if (name) await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

function newGroupField(page: Page) {
  return page.getByRole("textbox", { name: "Новая группа" });
}

function groupButton(page: Page, name: string) {
  return page.getByRole("button", { name, exact: true });
}

async function createGroupInCard(page: Page, name: string) {
  await newGroupField(page).fill(name);
  await newGroupField(page).press("Enter");
  await expect(groupButton(page, name)).toHaveAttribute("aria-pressed", "true");
}

// Returns once the save has finished: the button changes before that
async function pressGroup(page: Page, name: string) {
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === "POST"),
    groupButton(page, name).click(),
  ]);
}

// A group with these people, created straight in the test database: faster than through the card
async function seedGroup(groupName: string, contactNames: string[]) {
  return withTestDb(async (db) => {
    const [group] = await db.insert(groups).values({ name: groupName }).returning();
    if (contactNames.length > 0) {
      const added = await db
        .insert(contacts)
        .values(contactNames.map((name) => ({ name })))
        .returning({ id: contacts.id });
      await db
        .insert(contactGroups)
        .values(added.map(({ id }) => ({ contactId: id, groupId: group.id })));
    }
    return group.id;
  });
}

function groupLink(page: Page, name: string) {
  return page.getByRole("link", { name: new RegExp(`^${name} \\d+$`) });
}

function allContactsLink(page: Page) {
  return page.getByRole("link", { name: "Все", exact: true });
}

test("there are no group buttons while there are no groups", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("contact-row").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Все", exact: true })).toHaveCount(0);
});

test("the 'Группы' page says where groups are created while there are none", async ({ page }) => {
  await page.goto("/groups");
  await expect(page.getByRole("heading", { level: 1, name: "Группы" })).toBeVisible();
  await expect(page.getByText("Группы создаются в карточке контакта")).toBeVisible();
});

test("a new group is created from the card with the contact in it", async ({ page }) => {
  await addContact(page, unique("Новая группа"));
  const group = unique("Теннис");

  await createGroupInCard(page, group);

  await expect(newGroupField(page)).toHaveValue("");
  await page.reload();
  await expect(groupButton(page, group)).toHaveAttribute("aria-pressed", "true");
});

test("an existing name adds the contact to that group instead of a second one", async ({
  page,
}) => {
  const group = unique("Волейбол");
  await addContact(page, unique("Первый"));
  await createGroupInCard(page, group);

  await addContact(page, unique("Второй"));
  await newGroupField(page).fill(group.toLowerCase());
  await newGroupField(page).press("Enter");

  await expect(groupButton(page, group)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: group.toLowerCase() })).toHaveCount(1);
});

test("a name of spaces only shows a message and creates nothing", async ({ page }) => {
  await addContact(page, unique("Пустая группа"));
  await newGroupField(page).fill("   ");
  await page.getByRole("button", { name: "Добавить группу" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Укажите название" })).toBeVisible();
});

test("pressing a group puts the contact in it, right away and for good", async ({ page }) => {
  const group = unique("Друзья");
  await addContact(page, unique("Создаёт группу"));
  await createGroupInCard(page, group);

  await addContact(page, unique("Вступает"));
  await expect(groupButton(page, group)).toHaveAttribute("aria-pressed", "false");

  await pressGroup(page, group);
  await expect(groupButton(page, group)).toHaveAttribute("aria-pressed", "true");

  await page.reload();
  await expect(groupButton(page, group)).toHaveAttribute("aria-pressed", "true");
});

test("pressing a group again takes the contact out of it", async ({ page }) => {
  const group = unique("Коллеги");
  await addContact(page, unique("Выходит"));
  await createGroupInCard(page, group);

  await pressGroup(page, group);
  await expect(groupButton(page, group)).toHaveAttribute("aria-pressed", "false");

  await page.reload();
  await expect(groupButton(page, group)).toHaveAttribute("aria-pressed", "false");
});

test("a contact can be in several groups", async ({ page }) => {
  const first = unique("Семья");
  const second = unique("Соседи");
  await addContact(page, unique("В двух группах"));
  await createGroupInCard(page, first);
  await createGroupInCard(page, second);

  await page.reload();
  await expect(groupButton(page, first)).toHaveAttribute("aria-pressed", "true");
  await expect(groupButton(page, second)).toHaveAttribute("aria-pressed", "true");
});

test("changing the groups of a contact deleted in another tab says it is not found", async ({
  page,
}) => {
  const group = unique("Удалённый контакт");
  await addContact(page, unique("Владелец группы"));
  await createGroupInCard(page, group);

  const id = await addContact(page, unique("Удалят в другой вкладке"));
  const otherTab = await page.context().newPage();
  await otherTab.goto(`/contacts/${id}`);
  await otherTab.getByRole("button", { name: "Удалить", exact: true }).click();
  await otherTab.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(otherTab).toHaveURL(/\/\?deleted=/);
  await otherTab.close();

  await groupButton(page, group).click();
  await expect(page.getByRole("alert").filter({ hasText: "Контакт не найден" })).toBeVisible();
});

test("deleting a contact leaves its group with one person less", async ({ page }) => {
  const group = unique("Остаётся");
  const stays = await addContact(page, unique("Остаётся в группе"));
  await createGroupInCard(page, group);

  const leaves = await addContact(page, unique("Уходит"));
  await pressGroup(page, group);
  await expect(groupButton(page, group)).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Удалить", exact: true }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click();
  await expect(page).toHaveURL(/\/\?deleted=/);

  const [members] = await withTestDb((db) =>
    db.select({ value: count() }).from(contactGroups).where(eq(contactGroups.contactId, leaves)),
  );
  expect(members.value).toBe(0);
  await openCard(page, stays);
  await expect(groupButton(page, group)).toHaveAttribute("aria-pressed", "true");
  const [left] = await withTestDb((db) =>
    db.select({ value: count() }).from(contacts).where(eq(contacts.id, leaves)),
  );
  expect(left.value).toBe(0);
});

test("choosing a group leaves only its contacts", async ({ page }) => {
  const group = unique("Выбор группы");
  await seedGroup(group, [unique("Первый в группе"), unique("Второй в группе")]);

  await page.goto("/");
  await groupLink(page, group).click();

  await expect(page.getByTestId("contact-row")).toHaveCount(2);
  await expect(page.getByText("2 контакта", { exact: true })).toBeVisible();
  await expect(groupLink(page, group)).toHaveAttribute("aria-current", "true");
});

test("a group without people says so instead of the list", async ({ page }) => {
  const group = unique("Пустая");
  await seedGroup(group, []);

  await page.goto("/");
  await groupLink(page, group).click();

  await expect(page.getByText("В этой группе пока никого")).toBeVisible();
  await expect(page.getByTestId("contact-row")).toHaveCount(0);
});

test("'Все' brings all contacts back", async ({ page }) => {
  const group = unique("Назад ко всем");
  await seedGroup(group, [unique("Один в группе")]);

  await page.goto("/");
  await groupLink(page, group).click();
  await expect(page.getByTestId("contact-row")).toHaveCount(1);

  await allContactsLink(page).click();
  await expect(allContactsLink(page)).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("contact-row").nth(1)).toBeVisible();
});

test("search works inside the chosen group", async ({ page }) => {
  const group = unique("Поиск в группе");
  const found = unique("Найдётся");
  const groupId = await seedGroup(group, [found, unique("Останется")]);

  await page.goto(`/?group=${groupId}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("searchbox", { name: "Поиск по имени" }).fill(found);

  await expect(page.getByText("Найдено: 1 из 2")).toBeVisible();
  await expect(page.getByTestId("contact-row")).toHaveCount(1);
  await expect(groupLink(page, group)).toHaveAttribute("aria-current", "true");
});

test("a name from outside the chosen group isn't found", async ({ page }) => {
  const group = unique("Только свои");
  const outsider = unique("Посторонний");
  const groupId = await seedGroup(group, [unique("Свой один"), unique("Свой два")]);
  await seedGroup(unique("Другая группа"), [outsider]);

  await page.goto(`/?group=${groupId}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("searchbox", { name: "Поиск по имени" }).fill(outsider);

  await expect(page.getByText("Найдено: 0 из 2")).toBeVisible();
  await expect(page.getByTestId("contact-row")).toHaveCount(0);
});

test("the 'Пора связаться' block is hidden while a group is chosen", async ({ page }) => {
  const group = unique("Без блока");
  await seedGroup(group, [unique("В группе без блока")]);
  const [due] = await withTestDb((db) =>
    db
      .insert(contacts)
      .values({
        name: unique("Пора написать"),
        keepInTouchFrequency: "week",
        keepInTouchSince: sql`now() - interval '30 days'`,
      })
      .returning({ id: contacts.id }),
  );

  try {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Пора связаться" })).toBeVisible();

    await groupLink(page, group).click();
    await expect(page.getByTestId("contact-row")).toHaveCount(1);
    await expect(page.getByRole("heading", { name: "Пора связаться" })).toHaveCount(0);
  } finally {
    // keep-in-touch.spec.ts starts with nobody due
    await withTestDb((db) => db.delete(contacts).where(eq(contacts.id, due.id)));
  }
});

test("the address of a deleted group shows all contacts", async ({ page }) => {
  await page.goto("/?group=2147483647");

  await expect(allContactsLink(page)).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("contact-row").nth(1)).toBeVisible();
});

test("the list shows a contact's groups by the name", async ({ page }) => {
  const person = unique("С метками");
  const first = unique("Аметка");
  const second = unique("Бметка");
  const id = await addContact(page, person);
  await createGroupInCard(page, second);
  await createGroupInCard(page, first);

  await page.goto(`/?q=${encodeURIComponent(person)}`);
  const row = page.getByTestId("contact-row").filter({ hasText: person });
  await expect(row.getByTestId("contact-group")).toHaveText([first, second]);

  await withTestDb((db) => db.delete(contactGroups).where(eq(contactGroups.contactId, id)));
  await page.reload();
  await expect(row.getByTestId("contact-group")).toHaveCount(0);
});

function groupRow(page: Page, name: string) {
  return page.getByTestId("group-row").filter({ hasText: name });
}

async function openGroupsPage(page: Page) {
  await page.goto("/groups");
  await expect(page.getByRole("heading", { level: 1, name: "Группы" })).toBeVisible();
  await page.waitForLoadState("networkidle");
}

async function renameGroup(page: Page, oldName: string, newName: string) {
  await groupRow(page, oldName).getByRole("button", { name: "Переименовать группу" }).click();
  const field = page.getByRole("textbox", { name: "Название группы" });
  await field.fill(newName);
  await field.press("Enter");
}

test("renaming a group changes it on every screen and keeps its people", async ({ page }) => {
  const oldName = unique("Тенис");
  const newName = unique("Теннис настоящий");
  const person = unique("Остаётся при переименовании");
  await seedGroup(oldName, [person]);

  await openGroupsPage(page);
  await expect(groupRow(page, oldName)).toContainText("1 контакт");
  await renameGroup(page, oldName, newName);
  await expect(groupRow(page, newName)).toBeVisible();
  await expect(groupRow(page, oldName)).toHaveCount(0);

  await page.goto(`/?q=${encodeURIComponent(person)}`);
  await expect(page.getByTestId("contact-group")).toHaveText([newName]);
  await expect(groupLink(page, newName)).toBeVisible();
});

test("a group can't take the name of another one", async ({ page }) => {
  const taken = unique("Занято");
  const other = unique("Другая");
  await seedGroup(taken, []);
  await seedGroup(other, []);

  await openGroupsPage(page);
  await renameGroup(page, other, taken.toLowerCase());
  await expect(page.getByRole("alert").filter({ hasText: "Такая группа уже есть" })).toBeVisible();

  await page.reload();
  await expect(groupRow(page, other)).toHaveCount(1);
});

test("a group can change only the case of its name", async ({ page }) => {
  const name = unique("регистр");
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  await seedGroup(name, []);

  await openGroupsPage(page);
  await renameGroup(page, name, capitalized);
  await expect(page.getByRole("textbox", { name: "Название группы" })).toHaveCount(0);

  await page.reload();
  await expect(groupRow(page, capitalized).getByText(capitalized, { exact: true })).toBeVisible();
});

test("renaming a group deleted in another tab says it is not found", async ({ page }) => {
  const name = unique("Удалят");
  const groupId = await seedGroup(name, []);

  await openGroupsPage(page);
  await groupRow(page, name).getByRole("button", { name: "Переименовать группу" }).click();
  await withTestDb((db) => db.delete(groups).where(eq(groups.id, groupId)));
  const field = page.getByRole("textbox", { name: "Название группы" });
  await field.fill(unique("Новое название"));
  await field.press("Enter");

  await expect(page.getByRole("alert").filter({ hasText: "Группа не найдена" })).toBeVisible();
});

test("deleting a group leaves its people without it", async ({ page }) => {
  const group = unique("Удаляемая");
  const person = unique("Переживёт группу");
  await seedGroup(group, [person, unique("И этот тоже")]);

  await openGroupsPage(page);
  await groupRow(page, group).getByRole("button", { name: "Удалить группу" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(`Удалить группу «${group}»?`);
  await expect(dialog).toContainText("Контакты останутся");
  await dialog.getByRole("button", { name: "Удалить" }).click();
  await expect(groupRow(page, group)).toHaveCount(0);

  await page.goto(`/?q=${encodeURIComponent(person)}`);
  await expect(page.getByTestId("contact-row")).toHaveCount(1);
  await expect(page.getByTestId("contact-group")).toHaveCount(0);
});

test("'Отмена' in the dialog keeps the group", async ({ page }) => {
  const group = unique("Передумали");
  await seedGroup(group, []);

  await openGroupsPage(page);
  await groupRow(page, group).getByRole("button", { name: "Удалить группу" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(groupRow(page, group)).toHaveCount(1);
});
