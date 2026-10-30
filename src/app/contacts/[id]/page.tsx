import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PencilIcon } from "lucide-react";

import { addNoteAction, deleteContactAction } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { DeleteContactButton } from "@/components/delete-contact-button";
import { NoteForm } from "@/components/note-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { parseContactId } from "@/lib/contact-schema";
import { getContactWithNotes } from "@/lib/contacts";
import { formatDateTime, pluralize } from "@/lib/format";

export default function ContactPage({ params, searchParams }: PageProps<"/contacts/[id]">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-6">
      <BackLink />
      <Suspense fallback={<ContactFallback />}>
        <ContactDetails params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function ContactDetails({ params, searchParams }: PageProps<"/contacts/[id]">) {
  const contactId = parseContactId((await params).id);
  if (!contactId) notFound();

  const contact = await getContactWithNotes(contactId);
  if (!contact) notFound();

  // Set by the edit form after saving
  const saved = (await searchParams).saved === "1";

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
      {saved && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-accent-soft px-4 py-3 text-base ring-1 ring-accent/25"
        >
          Изменения сохранены
        </p>
      )}

      <Card className="mt-3">
        <CardHeader>
          <CardTitle>
            <h1 className="text-3xl sm:text-4xl">{contact.name}</h1>
          </CardTitle>
          {contact.about && (
            <CardDescription className="mt-1 text-base sm:text-lg">{contact.about}</CardDescription>
          )}
          <CardAction className="flex flex-wrap justify-end gap-2">
            <Link
              href={`/contacts/${contact.id}/edit`}
              className={buttonVariants({ variant: "outline" })}
            >
              <PencilIcon />
              Изменить
            </Link>
            <DeleteContactButton
              name={contact.name}
              noteCount={contact.notes.length}
              action={deleteContactAction.bind(null, contact.id)}
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-3 border-t border-glass-border pt-5 sm:grid-cols-[auto_1fr]">
            {details.map(({ label, value, href }) => (
              <div key={label} className="contents">
                <dt className="text-sm text-muted-foreground sm:text-base">{label}</dt>
                <dd className="-mt-2 text-base sm:mt-0">
                  {!value ? (
                    <span className="text-muted-foreground">не указано</span>
                  ) : href ? (
                    <a href={href} className="text-accent underline-offset-4 hover:underline">
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

      <section className="mt-10" aria-labelledby="notes-heading">
        <h2
          id="notes-heading"
          className="font-heading text-2xl font-bold tracking-heading sm:text-3xl"
        >
          Заметки
          <span className="ml-3 font-sans text-sm font-normal text-muted-foreground sm:text-base">
            {contact.notes.length > 0
              ? pluralize(contact.notes.length, ["заметка", "заметки", "заметок"])
              : "пока нет"}
          </span>
        </h2>

        <div className="mt-4">
          <NoteForm action={addNoteAction.bind(null, contact.id)} />
        </div>

        {contact.notes.length > 0 && (
          <ol
            className="mt-6 rounded-xl bg-card px-5 ring-1 ring-foreground/10 sm:px-6"
            data-testid="notes"
          >
            {contact.notes.map((note) => (
              <li
                key={note.id}
                className="border-t border-glass-border py-4 first:border-t-0 sm:py-5"
                data-testid="note"
              >
                <time
                  dateTime={note.createdAt.toISOString()}
                  className="text-sm font-bold text-accent"
                >
                  {formatDateTime(note.createdAt)}
                </time>
                <p className="mt-1.5 text-base/relaxed whitespace-pre-wrap">{note.body}</p>
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
    <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-card py-16 text-base text-muted-foreground ring-1 ring-foreground/10">
      <Spinner />
      Загружаю карточку…
    </div>
  );
}
