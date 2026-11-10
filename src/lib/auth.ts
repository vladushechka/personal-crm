import "server-only";

import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { and, count, eq, gt, like, sql } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { getDb } from "@/db";
import * as schema from "@/db/schema";
import { magicLinkSends, verifications } from "@/db/schema";

import { emailSchema } from "./email-schema";
import { sendSignInEmail } from "./mailer";

const DAY = 24 * 60 * 60;
const LINK_LIFETIME = 15 * 60;
const EMAILS_PER_WINDOW = 3;
const EMAIL_WINDOW = "10 minutes";

export const TOO_OFTEN = "Слишком часто, попробуй через несколько минут";

// Asking for a link, both from the form and straight to /api/auth/sign-in/magic-link:
// the same email check, the limit of 3 emails per address in 10 minutes, and a new link
// makes the earlier links of this address stop working
const beforeSignInLink = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/sign-in/magic-link") return;

  const parsed = emailSchema.safeParse(ctx.body?.email);
  if (!parsed.success) {
    throw new APIError("BAD_REQUEST", { message: parsed.error.issues[0]?.message });
  }
  const email = parsed.data;
  const db = getDb();

  const [{ value: recent }] = await db
    .select({ value: count() })
    .from(magicLinkSends)
    .where(
      and(
        eq(magicLinkSends.email, email),
        gt(magicLinkSends.sentAt, sql`now() - ${EMAIL_WINDOW}::interval`),
      ),
    );
  if (recent >= EMAILS_PER_WINDOW) throw new APIError("TOO_MANY_REQUESTS", { message: TOO_OFTEN });

  // Links are stored as hashes, so they are found by the email inside the stored value
  await db
    .delete(verifications)
    .where(
      and(
        like(verifications.identifier, "magic-link:%"),
        sql`strpos(${verifications.value}, ${`"email":${JSON.stringify(email)}`}) > 0`,
      ),
    );

  return { context: { body: { ...ctx.body, email } } };
});

function createAuth() {
  return betterAuth({
    appName: "Personal CRM",
    database: drizzleAdapter(getDb(), { provider: "pg", usePlural: true, schema }),
    // Signed in for 30 days since the last visit: a visit a day or more after the last
    // prolonging moves the end again
    session: { expiresIn: 30 * DAY, updateAge: DAY },
    hooks: { before: beforeSignInLink },
    plugins: [
      magicLink({
        expiresIn: LINK_LIFETIME,
        storeToken: "hashed",
        // Per address of the visitor. Tests open many links from one address, and a 32-letter
        // link can't be guessed anyway
        rateLimit: { window: 60, max: 30 },
        sendMagicLink: async ({ email, url }) => {
          await sendSignInEmail(email, url);
          await getDb().insert(magicLinkSends).values({ email });
        },
      }),
      // Sets the cookies from server actions; must be the last plugin
      nextCookies(),
    ],
  });
}

// Created on first use, not on import: building the app needs no secret
let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  auth ??= createAuth();
  return auth;
}
