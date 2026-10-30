import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { updateContactAction } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { ContactForm } from "@/components/contact-form";
import { ResetOnNavigation } from "@/components/reset-on-navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { contactFields, parseContactId } from "@/lib/contact-schema";
import { getContact } from "@/lib/contacts";

export const metadata: Metadata = {
  title: "Изменить контакт · Personal CRM",
};

export default function EditContactPage({ params }: PageProps<"/contacts/[id]/edit">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-6">
      <BackLink />
      <Suspense fallback={<EditContactFallback />}>
        <EditContact params={params} />
      </Suspense>
    </main>
  );
}

async function EditContact({ params }: Pick<PageProps<"/contacts/[id]/edit">, "params">) {
  const contactId = parseContactId((await params).id);
  if (!contactId) notFound();

  const contact = await getContact(contactId);
  if (!contact) notFound();

  const defaultValues = Object.fromEntries(
    contactFields.map((field) => [field, contact[field] ?? ""]),
  );

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>
          <h1 className="text-2xl sm:text-3xl">Изменить контакт</h1>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Each "Изменить" click must show the saved values, not a draft left after "Отмена" */}
        <ResetOnNavigation>
          <ContactForm
            action={updateContactAction.bind(null, contact.id)}
            defaultValues={defaultValues}
            submitLabel="Сохранить изменения"
            cancelHref={`/contacts/${contact.id}`}
          />
        </ResetOnNavigation>
      </CardContent>
    </Card>
  );
}

function EditContactFallback() {
  return (
    <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-card py-16 text-base text-muted-foreground ring-1 ring-foreground/10">
      <Spinner />
      Загружаю контакт…
    </div>
  );
}
