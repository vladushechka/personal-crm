import { describe, expect, it } from "vitest";

import { signInEmail } from "./sign-in-email";

describe("signInEmail", () => {
  const url = "https://app.vladmath.com/api/auth/magic-link/verify?token=abc&callbackURL=%2F";
  const email = signInEmail(url);

  it("has the subject with the app name", () => {
    expect(email.subject).toBe("Вход в Personal CRM");
  });

  it("has a «Войти» button leading to the link", () => {
    expect(email.html).toContain(`href="${url.replaceAll("&", "&amp;")}"`);
    expect(email.html).toMatch(/>\s*Войти\s*</);
  });

  it("says how long the link works and what to do if you did not ask", () => {
    for (const body of [email.html, email.text]) {
      expect(body).toContain("Ссылка работает 15 минут.");
      expect(body).toContain("Если вы не запрашивали вход - просто проигнорируйте письмо");
    }
  });

  it("has the link in the text version for mail apps without HTML", () => {
    expect(email.text).toContain(url);
  });
});
