// The sign-in email: a «Войти» button with the link, in HTML and as plain text
export function signInEmail(url: string) {
  const href = url.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  const lifetime = "Ссылка работает 15 минут.";
  const notMe = "Если вы не запрашивали вход - просто проигнорируйте письмо";

  return {
    subject: "Вход в Personal CRM",
    html: `<!doctype html>
<html lang="ru">
  <body style="margin:0;padding:24px;font-family:Arial,sans-serif;color:#1f2937;background:#f6f5f2">
    <div style="max-width:480px;margin:0 auto;padding:24px;background:#ffffff;border-radius:12px">
      <p style="margin:0 0 16px;font-size:18px">Вход в Personal CRM</p>
      <p style="margin:0 0 24px">
        <a href="${href}" style="display:inline-block;padding:12px 24px;border-radius:8px;background:#1f2937;color:#ffffff;text-decoration:none;font-weight:bold">Войти</a>
      </p>
      <p style="margin:0 0 8px">${lifetime}</p>
      <p style="margin:0;color:#6b7280">${notMe}</p>
    </div>
  </body>
</html>`,
    text: `Вход в Personal CRM

Войти: ${url}

${lifetime}
${notMe}
`,
  };
}
