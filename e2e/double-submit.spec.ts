// Pressing "save" again while the first save is still in progress must not save twice.
// The network is slowed down, so the first save is still running on the second press

import { expect, test, type Page } from "@playwright/test";

// Every request takes about 2 seconds, slower than mobile 3G
async function slowDownNetwork(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 2000,
    downloadThroughput: 50_000,
    uploadThroughput: 50_000,
  });
  return async function restoreNetwork() {
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
  };
}

// The page reacts to keys only after its scripts have loaded
async function openInteractive(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

async function countContactsNamed(page: Page, name: string) {
  await page.goto(`/?q=${encodeURIComponent(name)}`);
  await expect(page.getByText(/^Найдено: /)).toBeVisible();
  return page.getByTestId("contact-row").count();
}

test("Ctrl+Enter pressed twice while a note is saving saves it once", async ({ page }) => {
  const name = `Двойная заметка ${Date.now().toString(36)}`;
  await openInteractive(page, "/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill(name);
  await page.getByRole("button", { name: "Сохранить контакт" }).click();
  await page.getByRole("link", { name }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();

  const note = page.getByRole("textbox", { name: "Новая заметка" });
  const saveButton = page.getByRole("button", { name: "Сохранить заметку" });
  await note.fill("Заметка, которая должна сохраниться один раз");

  const restoreNetwork = await slowDownNetwork(page);
  await note.press("Control+Enter");
  await page.waitForTimeout(150);
  await note.press("Control+Enter");

  // The button stays disabled until every queued save has finished
  await expect(page.getByTestId("note")).toHaveCount(1, { timeout: 30_000 });
  await expect(saveButton).toBeEnabled({ timeout: 30_000 });
  await restoreNetwork();

  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByTestId("note")).toHaveCount(1);
});

test("Enter pressed twice while a contact is saving adds it once", async ({ page }) => {
  const name = `Двойной Enter ${Date.now().toString(36)}`;
  await openInteractive(page, "/contacts/new");
  const nameField = page.getByRole("textbox", { name: "Имя" });
  await nameField.fill(name);

  const restoreNetwork = await slowDownNetwork(page);
  await nameField.press("Enter");
  await page.waitForTimeout(150);
  await nameField.press("Enter");
  await expect(page).toHaveURL(/\/\?added=\d+$/, { timeout: 30_000 });
  await restoreNetwork();

  expect(await countContactsNamed(page, name)).toBe(1);
});

test("double click on 'Сохранить контакт' while saving adds the contact once", async ({ page }) => {
  const name = `Двойной щелчок ${Date.now().toString(36)}`;
  await openInteractive(page, "/contacts/new");
  await page.getByRole("textbox", { name: "Имя" }).fill(name);

  const restoreNetwork = await slowDownNetwork(page);
  await page.getByRole("button", { name: "Сохранить контакт" }).dblclick();
  await expect(page).toHaveURL(/\/\?added=\d+$/, { timeout: 30_000 });
  await restoreNetwork();

  expect(await countContactsNamed(page, name)).toBe(1);
});
