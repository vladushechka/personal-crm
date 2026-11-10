import "server-only";

import { createTransport, type Transporter } from "nodemailer";

import { signInEmail } from "./sign-in-email";

// Where emails go is a setting, not code: SMTP_URL points at Mailpit locally and in tests,
// at Resend on the server. Created on the first email, so building the app needs no settings
let transporter: Transporter | undefined;

function getTransporter() {
  const url = process.env.SMTP_URL;
  if (!url) throw new Error("SMTP_URL is not set: there is nowhere to send emails");
  transporter ??= createTransport(url);
  return transporter;
}

export async function sendSignInEmail(to: string, url: string) {
  const from = process.env.MAIL_FROM;
  if (!from) throw new Error("MAIL_FROM is not set: emails need a sender");
  await getTransporter().sendMail({ from, to, ...signInEmail(url) });
}
