import { NextResponse, type NextRequest } from "next/server";

import { getAuth } from "@/lib/auth";

// Every page needs signing in. Without a session - the sign-in page. With one, a visit prolongs
// it (30 days since the last visit): Better Auth sets the cookie again here (its nextCookies
// plugin), because a page itself can't. Pages and server actions check the user again on their
// own (session.ts)
export async function proxy(request: NextRequest) {
  // Better Auth doesn't prolong a session for requests with the RSC header of client-side
  // navigation, so it doesn't get that header here
  const headers = new Headers(request.headers);
  headers.delete("rsc");
  const session = await getAuth().api.getSession({ headers });

  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  // Not for the sign-in page, the sign-in endpoints, the deploy check and static files
  matcher: ["/((?!login|api/auth|health|_next/static|_next/image|favicon\.ico|.*\.svg$).*)"],
};
