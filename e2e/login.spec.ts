// Signing in by a link from the email: openspec/changes/login/specs/user-auth (first part).
// Every test starts signed out and uses its own email addresses

import { expect, test, type Page } from "@playwright/test";
import { eq, sql } from "drizzle-orm";

import { magicLinkSends, verifications } from "../src/db/schema";

import {
  captureServerAction,
  replayServerAction,
  requestSignInLink,
  signIn,
  submitSignInForm,
  uniqueEmail,
} from "./auth";
import { E2E_OWNER_EMAIL } from "./constants";
import { countMessagesTo, waitForMessageTo } from "./mailpit";
import { withTestDb } from "./test-db";

test.use({ storageState: { cookies: [], origins: [] } });

const EXPIRED = "Ссылка устарела, запроси новую";

async function expectSignInPage(page: Page) {
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("textbox", { name: "Почта" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Получить ссылку" })).toBeVisible();
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
  await page.waitForLoadState("networkidle");
  return id;
}

test.describe("closed without signing in", () => {
  test("a guest opening the app sees the sign-in page", async ({ page }) => {
    await page.goto("/");
    await expectSignInPage(page);
  });

  test("a guest opening a contact card by its address sees the sign-in page and no contact", async ({
    page,
    browser,
  }) => {
    const owner = await browser.newPage();
    await signIn(owner, uniqueEmail("card-owner"));
    const name = `Карточка без входа ${Date.now().toString(36)}`;
    const id = await addContact(owner, name);

    await page.goto(`/contacts/${id}`);
    await expectSignInPage(page);
    await expect(page.getByText(name)).toHaveCount(0);
    await owner.close();
  });

  test("a server action sent without signing in changes nothing", async ({ browser, request }) => {
    const owner = await browser.newPage();
    await signIn(owner, uniqueEmail("action-owner"));
    await addContact(owner, `Действие без входа ${Date.now().toString(36)}`);

    const note = `Заметка владельца ${Date.now().toString(36)}`;
    await owner.getByRole("textbox", { name: "Новая заметка" }).fill(note);
    const action = await captureServerAction(owner, () =>
      owner.getByRole("button", { name: "Сохранить заметку" }).click(),
    );
    await expect(owner.getByTestId("note").filter({ hasText: note })).toHaveCount(1);

    // The same request without the owner's sign-in: no second note
    await replayServerAction(request, action);
    await owner.reload();
    await expect(owner.getByTestId("note").filter({ hasText: note })).toHaveCount(1);
    await owner.close();
  });
});

test.describe("asking for a link", () => {
  test("the link is sent: a message on the page and an email with the link", async ({ page }) => {
    const email = uniqueEmail("sent");
    const link = await requestSignInLink(page, email);
    expect(link).toContain("/api/auth/magic-link/verify?token=");
  });

  test("after sending, the form gives way to the message and «Не пришла ссылка?» sends again", async ({
    page,
  }) => {
    const email = uniqueEmail("resend");
    await requestSignInLink(page, email);
    await expect(page.getByRole("textbox", { name: "Почта" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Получить ссылку" })).toHaveCount(0);

    await page.getByRole("button", { name: "Не пришла ссылка?" }).click();
    await expect(page.getByText("Проверьте папку «Спам»")).toBeVisible();
    await page.getByRole("button", { name: "Отправить ещё раз" }).click();
    await waitForMessageTo(email, 2);
    await expect(page.getByRole("status")).toHaveText(`Ссылка для входа отправлена на ${email}`);
  });

  test("spaces and capital letters in the email lead to the same person", async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail("case");
    await signIn(page, email);
    const name = `Свой контакт ${Date.now().toString(36)}`;
    await addContact(page, name);

    const other = await browser.newPage();
    const link = await requestSignInLink(other, `  ${email.toUpperCase()} `);
    await other.goto(link);
    await expect(other.getByTestId("contact-row").filter({ hasText: name })).toHaveCount(1);
    await other.close();
  });

  test("the answer is the same for a known and a new email", async ({ page }) => {
    const messages: string[] = [];
    for (const email of [E2E_OWNER_EMAIL, uniqueEmail("unknown")]) {
      await requestSignInLink(page, email);
      const status = page.getByRole("status");
      messages.push((await status.textContent())!.replace(email, "<почта>"));
    }
    expect(messages[0]).toBe(messages[1]);
    expect(messages[0]).toContain("Ссылка для входа отправлена на <почта>");
  });

  test("a wrong email in the form shows «Проверь адрес почты» and sends nothing", async ({
    page,
  }) => {
    const email = `wrong-${Date.now().toString(36)}@example`;
    await submitSignInForm(page, email);
    await expect(page.getByText("Проверь адрес почты")).toBeVisible();
    expect(await countMessagesTo(email)).toBe(0);
  });

  test("a wrong email sent to the server bypassing the form sends nothing", async ({ request }) => {
    const email = `direct-${Date.now().toString(36)}@example`;
    const response = await request.post("/api/auth/sign-in/magic-link", {
      data: { email, callbackURL: "/" },
    });
    expect(response.status()).toBe(400);
    expect(await countMessagesTo(email)).toBe(0);
  });

  test("the email: from Personal CRM, «Войти», 15 minutes and what to do if you did not ask", async ({
    page,
  }) => {
    const email = uniqueEmail("letter");
    await submitSignInForm(page, email);
    const message = await waitForMessageTo(email);

    expect(message.From.Name).toBe("Personal CRM");
    expect(message.From.Address).toMatch(/^noreply@/);
    expect(message.Subject).toBe("Вход в Personal CRM");
    expect(message.HTML).toMatch(/>\s*Войти\s*</);
    for (const body of [message.HTML, message.Text]) {
      expect(body).toContain("Ссылка работает 15 минут.");
      expect(body).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");
    }
  });
});

test.describe("the link", () => {
  test("the first sign-in is the registration: straight to the contact list", async ({ page }) => {
    await signIn(page, uniqueEmail("first"));
    await expect(page.getByRole("textbox", { name: "Имя" })).toHaveCount(0);
  });

  test("a link opened a second time is outdated", async ({ page, browser }) => {
    const link = await requestSignInLink(page, uniqueEmail("twice"));
    await page.goto(link);
    await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();

    const other = await browser.newPage();
    await other.goto(link);
    await expect(other.getByText(EXPIRED)).toBeVisible();
    await other.getByRole("link", { name: "Получить новую ссылку" }).click();
    await expectSignInPage(other);
    await expect(other.getByText(EXPIRED)).toHaveCount(0);
    await other.close();
  });

  test("a link older than 15 minutes is outdated", async ({ page }) => {
    const email = uniqueEmail("old-link");
    const link = await requestSignInLink(page, email);
    await withTestDb((db) =>
      db
        .update(verifications)
        .set({ expiresAt: sql`now() - interval '1 minute'` })
        .where(sql`${verifications.value} like ${`%${email}%`}`),
    );

    await page.goto(link);
    await expect(page.getByText(EXPIRED)).toBeVisible();
  });

  test("a new link makes the earlier one outdated", async ({ page }) => {
    const email = uniqueEmail("two-links");
    const first = await requestSignInLink(page, email);
    const second = await requestSignInLink(page, email);

    await page.goto(first);
    await expect(page.getByText(EXPIRED)).toBeVisible();
    await page.goto(second);
    await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
  });
});

test.describe("the email limit", () => {
  test("a fourth email in 10 minutes is refused", async ({ page }) => {
    const email = uniqueEmail("limit");
    for (let sent = 0; sent < 3; sent++) await requestSignInLink(page, email);

    await submitSignInForm(page, email);
    await expect(page.getByText("Слишком часто, попробуй через несколько минут")).toBeVisible();
    expect(await countMessagesTo(email)).toBe(3);
  });

  test("10 minutes later an email can be sent again", async ({ page }) => {
    const email = uniqueEmail("limit-over");
    for (let sent = 0; sent < 3; sent++) await requestSignInLink(page, email);
    await withTestDb((db) =>
      db
        .update(magicLinkSends)
        .set({ sentAt: sql`now() - interval '11 minutes'` })
        .where(eq(magicLinkSends.email, email)),
    );

    await requestSignInLink(page, email);
    expect(await countMessagesTo(email)).toBe(4);
  });
});
