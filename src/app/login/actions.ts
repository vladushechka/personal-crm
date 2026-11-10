"use server";

import { headers } from "next/headers";

import { getAuth, TOO_OFTEN } from "@/lib/auth";
import { emailSchema } from "@/lib/email-schema";

export type SignInFormState = {
  // What was typed, so the form keeps it when something is wrong
  email?: string;
  error?: string;
  // The link is sent: the form gives way to the message and «Не пришла ссылка?»
  sentTo?: string;
  // When it was sent: a new email closes the «Не пришла ссылка?» help again
  sentAt?: number;
};

// Better Auth errors come from its own copy of the library in every route, so they are
// recognized by their status, not by their class
function isTooOften(error: unknown) {
  const { status, statusCode } = (error ?? {}) as { status?: unknown; statusCode?: unknown };
  return status === "TOO_MANY_REQUESTS" || statusCode === 429;
}

// The sign-in form and «Отправить ещё раз»: an email with the link, or what is wrong. The answer
// is the same for a new and a known email, so it doesn't tell who uses the app
export async function requestSignInLinkAction(
  _prevState: SignInFormState,
  formData: FormData,
): Promise<SignInFormState> {
  const email = String(formData.get("email") ?? "");
  // Sent from «Отправить ещё раз»: the answer stays on the «link is sent» view
  const resentAfter = Number(formData.get("sentAt")) || undefined;
  const failed = (error?: string): SignInFormState =>
    resentAfter ? { sentTo: email, sentAt: resentAfter, error } : { email, error };

  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return failed(parsed.error.issues[0]?.message);

  try {
    await getAuth().api.signInMagicLink({
      body: {
        email: parsed.data,
        callbackURL: "/",
        newUserCallbackURL: "/",
        // Better Auth adds ?error=... when the link does not work
        errorCallbackURL: "/login",
      },
      headers: await headers(),
    });
  } catch (error) {
    if (isTooOften(error)) return failed(TOO_OFTEN);
    throw error;
  }
  return { sentTo: parsed.data, sentAt: Date.now() };
}
