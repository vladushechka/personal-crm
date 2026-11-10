// The Mailpit mailbox catches every email the app sends during the tests (docker-compose.yml,
// and a service in CI). Its API: https://mailpit.axllent.org/docs/api-v1/

import { expect } from "@playwright/test";

const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:8025";

type MessageSummary = { ID: string };
export type Message = {
  ID: string;
  From: { Name: string; Address: string };
  Subject: string;
  HTML: string;
  Text: string;
};

async function api<T>(path: string): Promise<T> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/${path}`);
  if (!response.ok) throw new Error(`Mailpit ${path}: ${response.status}`);
  return (await response.json()) as T;
}

// Emails to the address, newest first. Every test uses its own addresses: "to:" matches a part
export async function messagesTo(email: string) {
  const query = encodeURIComponent(`to:"${email}"`);
  const result = await api<{ messages: MessageSummary[] }>(`search?query=${query}&limit=50`);
  return result.messages;
}

export async function countMessagesTo(email: string) {
  return (await messagesTo(email)).length;
}

// Waits for email number `count` to the address and returns the newest one
export async function waitForMessageTo(email: string, count = 1): Promise<Message> {
  await expect
    .poll(() => countMessagesTo(email), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(count);
  const [newest] = await messagesTo(email);
  return api<Message>(`message/${newest.ID}`);
}

// The sign-in link: the address of the «Войти» button
export function signInLink(message: Message) {
  const href = message.HTML.match(/<a href="([^"]+)"[^>]*>\s*Войти\s*</)?.[1];
  if (!href) throw new Error(`No «Войти» link in the email "${message.Subject}"`);
  return href.replaceAll("&amp;", "&");
}
