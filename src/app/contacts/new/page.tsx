import type { Metadata } from "next";

import { createContactAction } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Новый контакт · Личная CRM",
};

export default function NewContactPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <BackLink />
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl font-semibold">Новый контакт</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm action={createContactAction} submitLabel="Сохранить контакт" cancelHref="/" />
        </CardContent>
      </Card>
    </main>
  );
}
