// Signing in for the tests: through the real form and the link from the Mailpit mailbox

import { expect, type APIRequestContext, type Page, type Request } from "@playwright/test";

import { countMessagesTo, signInLink, waitForMessageTo } from "./mailpit";

let counter = 0;

// A new address for every call: the mailbox search matches part of an address
export function uniqueEmail(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}@e2e.test`;
}

// Fills the sign-in form; leaves the page showing the answer
export async function submitSignInForm(page: Page, email: string) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Почта" }).fill(email);
  await page.getByRole("button", { name: "Получить ссылку" }).click();
}

// Asks for a link and returns it once the email has arrived
export async function requestSignInLink(page: Page, email: string) {
  const address = email.trim().toLowerCase();
  const before = await countMessagesTo(address);
  await submitSignInForm(page, email);
  await expect(page.getByText(`Ссылка для входа отправлена на ${address}`)).toBeVisible();
  return signInLink(await waitForMessageTo(address, before + 1));
}

// Signs in and leaves the page on the contact list
export async function signIn(page: Page, email: string) {
  const link = await requestSignInLink(page, email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { level: 1, name: "Контакты" })).toBeVisible();
}

// A request of a server action (a form or a button on the page), to send it again by hand
export type ServerActionRequest = { url: string; headers: Record<string, string>; body: Buffer };

// Runs `trigger` and records the server action request it makes
export async function captureServerAction(page: Page, trigger: () => Promise<void>) {
  const [request] = await Promise.all([
    page.waitForRequest((r: Request) => r.method() === "POST" && "next-action" in r.headers()),
    trigger(),
  ]);
  const headers = request.headers();
  return {
    url: request.url(),
    headers: {
      "next-action": headers["next-action"],
      "content-type": headers["content-type"],
      accept: headers["accept"] ?? "text/x-component",
    },
    body: request.postDataBuffer() ?? Buffer.alloc(0),
  } satisfies ServerActionRequest;
}

// Sends a recorded server action again, with some text in it replaced, the way anyone could
// do it with their own tools, bypassing the page
export async function replayServerAction(
  request: APIRequestContext,
  action: ServerActionRequest,
  replace: [string, string][] = [],
) {
  let body = action.body.toString("latin1");
  for (const [from, to] of replace) body = body.replaceAll(from, to);
  return request.post(action.url, {
    headers: action.headers,
    data: Buffer.from(body, "latin1"),
    maxRedirects: 0,
  });
}
