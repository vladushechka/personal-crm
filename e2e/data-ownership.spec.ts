// Two people use the app and don't see or change each other's data:
// openspec/changes/login/specs/data-ownership and the contact-groups change.
// Each test signs in its own new users

import { expect, test, type Browser, type Page } from "@playwright/test";
import { asc, eq, sql } from "drizzle-orm";

import { contactGroups, contacts, groups, notes } from "../src/db/schema";

import {
  captureServerAction,
  replayServerAction,
  signIn,
  uniqueEmail,
  type ServerActionRequest,
} from "./auth";
import { withTestDb } from "./test-db";

test.use({ storageState: { cookies: [], origins: [] } });

function unique(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}

// A new user signed in in a browser of their own
async function newUser(browser: Browser, prefix: string) {
  const page = await (await browser.newContext()).newPage();
  await signIn(page, uniqueEmail(prefix));
  return page;
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

async function openCard(page: Page, id: number, name: string) {
  await page.goto(`/contacts/${id}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  // The card's controls react only after its scripts have loaded
  await page.waitForLoadState("networkidle");
}

async function addNote(page: Page, body: string) {
  await page.getByRole("textbox", { name: "Новая заметка" }).fill(body);
  await page.getByRole("button", { name: "Сохранить заметку" }).click();
  await expect(page.getByTestId("note").filter({ hasText: body })).toBeVisible();
}

async function addToNewGroup(page: Page, groupName: string) {
  const field = page.getByRole("textbox", { name: "Новая группа" });
  await field.fill(groupName);
  await field.press("Enter");
  await expect(page.getByRole("button", { name: groupName, pressed: true })).toBeVisible();
}

async function listRows(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
  return page.getByTestId("contact-row").allTextContents();
}

test("a new contact belongs to its author only", async ({ browser }) => {
  const a = await newUser(browser, "author-a");
  const b = await newUser(browser, "author-b");
  const name = unique("Контакт автора");
  await addContact(a, name);

  expect((await listRows(a)).some((row) => row.includes(name))).toBe(true);
  expect((await listRows(b)).some((row) => row.includes(name))).toBe(false);
});

test("B doesn't see A's contact: not in the list, not in search, «Контакт не найден» by link", async ({
  browser,
}) => {
  const a = await newUser(browser, "two-a");
  const name = unique("Контакт A");
  const id = await addContact(a, name);

  // B has a contact of their own: with none at all the list says it is empty instead
  const b = await newUser(browser, "two-b");
  await addContact(b, unique("Свой контакт B"));
  await b.goto("/");
  await expect(b.getByTestId("contact-row")).toHaveCount(1);
  await expect(b.getByTestId("contact-row").filter({ hasText: name })).toHaveCount(0);

  await b.goto(`/?q=${encodeURIComponent(name)}`);
  await expect(b.getByText("Никого не нашли")).toBeVisible();
  await expect(b.getByTestId("contact-row")).toHaveCount(0);

  await b.goto(`/contacts/${id}`);
  await expect(b.getByText("Контакт не найден")).toBeVisible();
  await expect(b.getByText(name)).toHaveCount(0);
});

test("groups and «Пора связаться» show only one's own", async ({ browser }) => {
  // A: a group and a contact it is time to talk to
  const a = await newUser(browser, "block-a");
  const aName = unique("Пора A");
  const aGroup = unique("Группа A");
  const aId = await addContact(a, aName);
  await addToNewGroup(a, aGroup);

  // B: a contact it is time to talk to as well, so B has the block
  const b = await newUser(browser, "block-b");
  const bName = unique("Пора B");
  const bId = await addContact(b, bName);

  await withTestDb((db) =>
    db
      .update(contacts)
      .set({ keepInTouchFrequency: "week", keepInTouchSince: sql`now() - interval '30 days'` })
      .where(sql`${contacts.id} in (${aId}, ${bId})`),
  );

  await b.goto("/");
  const block = b.getByTestId("reach-out-row");
  await expect(block.filter({ hasText: bName })).toHaveCount(1);
  await expect(block.filter({ hasText: aName })).toHaveCount(0);
  await expect(b.getByRole("navigation", { name: "Группы" })).toHaveCount(0);

  await b.goto("/groups");
  await expect(b.getByText(aGroup)).toHaveCount(0);
  await expect(b.getByText("Групп пока нет")).toBeVisible();
});

test("each has their own «Друзья», and «теннис» of B is not «Теннис» of A", async ({ browser }) => {
  const suffix = Date.now().toString(36);
  const a = await newUser(browser, "groups-a");
  await addContact(a, unique("Друг A"));
  await addToNewGroup(a, `Друзья ${suffix}`);
  await addContact(a, unique("Теннисист A"));
  await addToNewGroup(a, `Теннис ${suffix}`);

  const b = await newUser(browser, "groups-b");
  const bFriend = unique("Друг B");
  await addContact(b, bFriend);
  await addToNewGroup(b, `Друзья ${suffix}`);
  await addContact(b, unique("Теннисист B"));
  await addToNewGroup(b, `теннис ${suffix}`);

  // Each user sees one group of each name, with their own single person
  for (const [page, tennis] of [
    [a, `Теннис ${suffix}`],
    [b, `теннис ${suffix}`],
  ] as const) {
    await page.goto("/groups");
    await expect(page.getByTestId("group-row")).toHaveCount(2);
    await expect(
      page.getByTestId("group-row").filter({ hasText: `Друзья ${suffix}` }),
    ).toContainText("1 контакт");
    await expect(page.getByTestId("group-row").filter({ hasText: tennis })).toContainText(
      "1 контакт",
    );
  }
  const names = await withTestDb((db) =>
    db
      .select({ name: groups.name })
      .from(groups)
      .where(sql`${groups.name} ilike ${`%${suffix}`}`)
      .orderBy(asc(groups.name)),
  );
  expect(names.map(({ name }) => name).sort()).toEqual(
    [`Друзья ${suffix}`, `Друзья ${suffix}`, `Теннис ${suffix}`, `теннис ${suffix}`].sort(),
  );
});

test("a new user starts with an empty list and «Добавь первый контакт»", async ({ browser }) => {
  const page = await newUser(browser, "empty");
  await expect(page.getByText("Пока нет ни одного контакта")).toBeVisible();
  await expect(page.getByText("Добавь первый контакт")).toBeVisible();
  await expect(page.getByTestId("contact-row")).toHaveCount(0);
});

test("requests sent straight to the server with A's numbers change nothing of A", async ({
  browser,
}) => {
  // A: a contact with a note, in a group
  const a = await newUser(browser, "direct-a");
  const aName = unique("Контакт A под защитой");
  const aNote = unique("Заметка A");
  const aGroup = unique("Группа A под защитой");
  const aContact = await addContact(a, aName);
  await addNote(a, aNote);
  await addToNewGroup(a, aGroup);
  const [{ noteId: aNoteId, groupId: aGroupId }] = await withTestDb((db) =>
    db
      .select({ noteId: notes.id, groupId: contactGroups.groupId })
      .from(notes)
      .innerJoin(contactGroups, eq(contactGroups.contactId, notes.contactId))
      .where(eq(notes.contactId, aContact)),
  );

  // B does the same with their own data, and the requests are recorded on the way
  const b = await newUser(browser, "direct-b");
  const bName = unique("Контакт B");
  const bGroup = unique("Группа B");
  const bContact = await addContact(b, bName);
  const recorded: { action: ServerActionRequest; from: string; to: string }[] = [];
  async function record(from: string, to: string, trigger: () => Promise<void>) {
    recorded.push({ action: await captureServerAction(b, trigger), from, to });
  }

  // Add a note
  await b.getByRole("textbox", { name: "Новая заметка" }).fill(unique("Заметка B"));
  await record(`[${bContact},`, `[${aContact},`, () =>
    b.getByRole("button", { name: "Сохранить заметку" }).click(),
  );
  await expect(b.getByTestId("note")).toHaveCount(1);
  const [{ id: bNoteId }] = await withTestDb((db) =>
    db.select({ id: notes.id }).from(notes).where(eq(notes.contactId, bContact)),
  );

  // Choose how often to talk
  await b.getByRole("combobox", { name: "Как часто общаться" }).click();
  await record(`[${bContact},`, `[${aContact},`, () =>
    b.getByRole("option", { name: "Раз в неделю" }).click(),
  );

  // Put the contact in a new group, then take it out
  await b.getByRole("textbox", { name: "Новая группа" }).fill(bGroup);
  await record(`[${bContact},`, `[${aContact},`, () =>
    b.getByRole("textbox", { name: "Новая группа" }).press("Enter"),
  );
  await expect(b.getByRole("button", { name: bGroup, pressed: true })).toBeVisible();
  const [{ id: bGroupId }] = await withTestDb((db) =>
    db.select({ id: groups.id }).from(groups).where(eq(groups.name, bGroup)),
  );
  await record(`[${bContact},${bGroupId},`, `[${aContact},${aGroupId},`, () =>
    b.getByRole("button", { name: bGroup, pressed: true }).click(),
  );
  await expect(b.getByRole("button", { name: bGroup, pressed: false })).toBeVisible();

  // Edit the note, then delete it
  await b.getByRole("button", { name: "Изменить заметку" }).click();
  await b.getByRole("textbox", { name: "Текст заметки" }).fill(unique("Заметка B исправлена"));
  await record(`[${bContact},${bNoteId},`, `[${aContact},${aNoteId},`, () =>
    b.getByRole("button", { name: "Сохранить", exact: true }).click(),
  );
  await expect(b.getByRole("textbox", { name: "Текст заметки" })).toBeHidden();
  await b.getByRole("button", { name: "Удалить заметку" }).click();
  await record(`[${bContact},${bNoteId}]`, `[${aContact},${aNoteId}]`, () =>
    b.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click(),
  );
  await expect(b.getByTestId("note")).toHaveCount(0);

  // Edit the contact
  await b.goto(`/contacts/${bContact}/edit`);
  await b.waitForLoadState("networkidle");
  await b.getByRole("textbox", { name: "Имя" }).fill(unique("Контакт B переименован"));
  await record(`[${bContact},`, `[${aContact},`, () =>
    b.getByRole("button", { name: "Сохранить изменения" }).click(),
  );
  await expect(b).toHaveURL(new RegExp(`/contacts/${bContact}\\?saved=1$`));

  // Rename the group, then delete it
  await b.goto("/groups");
  await b.waitForLoadState("networkidle");
  const bGroupRow = b.getByTestId("group-row").filter({ hasText: bGroup });
  await bGroupRow.getByRole("button", { name: "Переименовать группу" }).click();
  await b.getByRole("textbox", { name: "Название группы" }).fill(`${bGroup} новая`);
  await record(`[${bGroupId},`, `[${aGroupId},`, () =>
    b.getByRole("textbox", { name: "Название группы" }).press("Enter"),
  );
  await expect(b.getByTestId("group-row").filter({ hasText: `${bGroup} новая` })).toBeVisible();
  await b.getByRole("button", { name: "Удалить группу" }).click();
  await record(`[${bGroupId}]`, `[${aGroupId}]`, () =>
    b.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click(),
  );
  await expect(b.getByTestId("group-row")).toHaveCount(0);

  // Delete the contact
  await openCard(b, bContact, await currentName(bContact));
  await b.getByRole("button", { name: "Удалить", exact: true }).click();
  await record(`[${bContact}]`, `[${aContact}]`, () =>
    b.getByRole("alertdialog").getByRole("button", { name: "Удалить" }).click(),
  );
  await expect(b).toHaveURL(/\/\?deleted=/);

  // Now the same requests from B, with A's numbers in them
  expect(recorded).toHaveLength(10);
  for (const { action, from, to } of recorded) {
    expect(action.body.toString("latin1")).toContain(from);
    await replayServerAction(b.request, action, [[from, to]]);
  }

  // Nothing of A has changed
  const [contact] = await withTestDb((db) =>
    db
      .select({ name: contacts.name, frequency: contacts.keepInTouchFrequency })
      .from(contacts)
      .where(eq(contacts.id, aContact)),
  );
  expect(contact).toEqual({ name: aName, frequency: null });
  const aNotes = await withTestDb((db) =>
    db.select({ body: notes.body }).from(notes).where(eq(notes.contactId, aContact)),
  );
  expect(aNotes).toEqual([{ body: aNote }]);
  const membership = await withTestDb((db) =>
    db
      .select({ name: groups.name })
      .from(contactGroups)
      .innerJoin(groups, eq(groups.id, contactGroups.groupId))
      .where(eq(contactGroups.contactId, aContact)),
  );
  expect(membership).toEqual([{ name: aGroup }]);

  await openCard(a, aContact, aName);
  await expect(a.getByTestId("note").filter({ hasText: aNote })).toHaveCount(1);
  await expect(a.getByRole("button", { name: aGroup, pressed: true })).toBeVisible();
});

async function currentName(contactId: number) {
  const [row] = await withTestDb((db) =>
    db.select({ name: contacts.name }).from(contacts).where(eq(contacts.id, contactId)),
  );
  return row.name;
}
