import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SignInForm } from "@/components/sign-in-form";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/session";

import { requestSignInLinkAction } from "./actions";

export const metadata: Metadata = { title: "Вход · Personal CRM" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <h1 className="font-heading text-3xl font-bold tracking-heading sm:text-4xl">Вход</h1>
      <Suspense>
        <LoginContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  // Signed in already: straight to the contacts
  if (await getCurrentUser()) redirect("/");

  // The link from the email didn't work: opened before, older than 15 minutes or replaced.
  // Better Auth sends here with ?error=INVALID_TOKEN, or another code if something else failed
  if ((await searchParams).error) return <LinkExpired />;

  return (
    <div className="mt-6">
      <p className="mb-5 text-muted-foreground">
        Введите почту: пришлём ссылку для входа. Пароль не нужен.
      </p>
      <SignInForm action={requestSignInLinkAction} />
    </div>
  );
}

function LinkExpired() {
  return (
    <div className="mt-6 flex flex-col items-start gap-5">
      <p role="alert" className="text-lg">
        Ссылка устарела, запроси новую
      </p>
      <Link href="/login" className={buttonVariants({ size: "lg" })}>
        Получить новую ссылку
      </Link>
    </div>
  );
}
