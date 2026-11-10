import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

// Sign-in endpoints: the link from the email (/api/auth/magic-link/verify) and the rest.
// The handler is made on the first request: building the app needs no secret
export async function GET(request: Request) {
  return toNextJsHandler(getAuth()).GET(request);
}

export async function POST(request: Request) {
  return toNextJsHandler(getAuth()).POST(request);
}
