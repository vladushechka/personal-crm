"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/lib/auth";

// Ends the sign-in on this device only: other devices stay signed in
export async function signOutAction() {
  await getAuth().api.signOut({ headers: await headers() });
  redirect("/login");
}
