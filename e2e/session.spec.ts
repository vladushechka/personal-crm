// Staying signed in, the header and signing out: openspec/changes/login/specs/user-auth
// (second part). Every test starts signed out and uses its own email addresses

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { eq, inArray, sql } from "drizzle-orm";

import { sessions, users } from "../src/db/schema";

import { signIn, uniqueEmail } from "./auth";
import { withTestDb } from "./test-db";

test.use({ storageState: { cookies: [], origins: [] } });

const DAY_MS = 24 * 60 * 60 * 1000;

async function expectSignedIn(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
}

async function expectSignedOut(page: Page) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
}

async function sessionCookie(context: BrowserContext) {
  const cookie = (await context.cookies()).find(({ name }) => name.endsWith("session_token"));
  if (!cookie) throw new Error("No session cookie");
  return cookie;
}

// Days from now to the moment the browser forgets the cookie
async function cookieDaysLeft(context: BrowserContext) {
  return ((await sessionCookie(context)).expires * 1000 - Date.now()) / DAY_MS;
}

function userSessions(email: string) {
  return inArray(
    sessions.userId,
    sql`(select ${users.id} from ${users} where ${eq(users.email, email)})`,
  );
}

async function sessionDaysLeft(email: string) {
  const [row] = await withTestDb((db) =>
    db.select({ expiresAt: sessions.expiresAt }).from(sessions).where(userSessions(email)),
  );
  return (row.expiresAt.getTime() - Date.now()) / DAY_MS;
}

test("signed in stays after the browser is closed and opened again", async ({ page, browser }) => {
  await signIn(page, uniqueEmail("reopen"));
  expect(await cookieDaysLeft(page.context())).toBeGreaterThan(29);

  // A new browser with the cookies the first one kept on disk
  const reopened = await browser.newContext({ storageState: await page.context().storageState() });
  await expectSignedIn(await reopened.newPage());
  await reopened.close();
});

test("a visit makes the sign-in last 30 days again", async ({ page }) => {
  const email = uniqueEmail("prolong");
  await signIn(page, email);
  // As if the last visit was 29 days ago: one day left, on the server and in the browser
  await withTestDb((db) =>
    db
      .update(sessions)
      .set({ expiresAt: sql`now() + interval '1 day'` })
      .where(userSessions(email)),
  );
  const cookie = await sessionCookie(page.context());
  await page.context().addCookies([{ ...cookie, expires: (Date.now() + DAY_MS) / 1000 }]);
  expect(await sessionDaysLeft(email)).toBeLessThan(2);
  expect(await cookieDaysLeft(page.context())).toBeLessThan(2);

  await expectSignedIn(page);
  expect(await sessionDaysLeft(email)).toBeGreaterThan(29);
  expect(await cookieDaysLeft(page.context())).toBeGreaterThan(29);
});

test("after 30 days without visits the sign-in page shows", async ({ page }) => {
  const email = uniqueEmail("expired");
  await signIn(page, email);
  await withTestDb((db) =>
    db
      .update(sessions)
      .set({ expiresAt: sql`now() - interval '1 minute'` })
      .where(userSessions(email)),
  );

  await expectSignedOut(page);
});

test("one person can be signed in on two devices", async ({ page, browser }) => {
  const email = uniqueEmail("two-devices");
  await signIn(page, email);
  const other = await browser.newPage();
  await signIn(other, email);

  await expectSignedIn(page);
  await expectSignedIn(other);
  await other.close();
});

test("the header shows the email and «Выйти»", async ({ page }) => {
  const email = uniqueEmail("header");
  await signIn(page, email);

  const header = page.getByRole("banner");
  await expect(header.getByText(email)).toBeVisible();
  await expect(header.getByRole("button", { name: "Выйти" })).toBeVisible();
});

test("on a narrow phone the header fits and «Выйти» can be pressed", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await signIn(page, uniqueEmail("narrow-phone-with-a-long-address"));

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  // Playwright refuses to click if anything else lies over the button
  await page.getByRole("banner").getByRole("button", { name: "Выйти" }).click({ timeout: 5_000 });
  await expect(page).toHaveURL(/\/login/);
});

test("«Выйти» signs out on this device only", async ({ page, browser }) => {
  const email = uniqueEmail("sign-out");
  await signIn(page, email);
  const other = await browser.newPage();
  await signIn(other, email);

  await page.getByRole("banner").getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login/);
  await expectSignedOut(page);
  await expectSignedIn(other);
  await other.close();
});
