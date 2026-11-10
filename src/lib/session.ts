import "server-only";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { getAuth } from "./auth";

// The signed-in user of this request, or null. Who is asking is known only from the session
// cookie: never from a form, an address or anything else the browser sends
export const getCurrentUser = cache(async () => {
  // Headers first: while building, the page stops here and Better Auth, which needs the secret,
  // is not created
  const requestHeaders = await headers();
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session?.user ?? null;
});

// For pages and server actions that work with the user's data: without signing in, the sign-in
// page instead, and nothing is read or changed
export async function requireUserId(): Promise<string> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user.id;
}
