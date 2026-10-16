import { notFound } from "next/navigation";
import { Suspense } from "react";

import { addNoteAction } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { NoteForm } from "@/components/note-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { getContactWithNotes } from "@/lib/contacts";
import { formatDateTime, pluralize } from "@/lib/format";

const MAX_ID = 2_147_483_647; // Postgres integer

function parseContactId(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id >= 1 && id <= MAX_ID ? id : null;
}

export default function ContactPage({ params }: PageProps<"/contacts/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <BackLink />
      <Suspense fallback={<ContactFallback />}>
        <ContactDetails params={params} />
      </Suspense>
    </main>
  );
}

async function ContactDetails({ params }: Pick<PageProps<"/contacts/[id]">, "params">) {
  const contactId = parseContactId((await params).id);
  if (!contactId) notFound();

  const contact = await getContactWithNotes(contactId);
  if (!contact) notFound();

  const details = [
    { label: "Откуда знакомы", value: contact.howWeMet },
    {
      label: "Телефон",
      value: contact.phone,
      href: contact.phone ? `tel:${contact.phone.replace(/[^\d+]/g, "")}` : undefined,
    },
    {
      label: "Почта",
      value: contact.email,
      href: contact.email ? `mailto:${contact.email}` : undefined,
    },
  ];

  return (
    <>
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold tracking-tight">{contact.name}</h1>
          </CardTitle>
          {contact.about && <CardDescription className="text-base">{contact.about}</CardDescription>}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
            {details.map(({ label, value, href }) => (
              <div key={label} className="contents">
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="-mt-2 text-sm sm:mt-0">
                  {!value ? (
                    <span className="text-muted-foreground">не указано</span>
                  ) : href ? (
                    <a href={href} className="underline-offset-4 hover:underline">
                      {value}
                    </a>
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <section className="mt-8" aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="text-lg font-semibold">
          Заметки
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {contact.notes.length > 0
              ? pluralize(contact.notes.length, ["заметка", "заметки", "заметок"])
              : "пока нет"}
          </span>
        </h2>

        <div className="mt-3">
          <NoteForm action={addNoteAction.bind(null, contact.id)} />
        </div>

        {contact.notes.length > 0 && (
          <ol className="mt-6 flex flex-col gap-3" data-testid="notes">
            {contact.notes.map((note) => (
              <li
                key={note.id}
                className="rounded-xl bg-background p-4 ring-1 ring-foreground/10"
                data-testid="note"
              >
                <time
                  dateTime={note.createdAt.toISOString()}
                  className="text-xs text-muted-foreground"
                >
                  {formatDateTime(note.createdAt)}
                </time>
                <p className="mt-1 text-sm whitespace-pre-wrap">{note.body}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function ContactFallback() {
  return (
    <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-background py-16 text-sm text-muted-foreground ring-1 ring-foreground/10">
      <Spinner />
      Загружаю карточку…
    </div>
  );
}
