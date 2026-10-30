import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon, SearchXIcon, UsersIcon } from "lucide-react";

import { ContactList, contactRowId } from "@/components/contact-list";
import { ContactSearch } from "@/components/contact-search";
import { ScrollIntoView } from "@/components/scroll-into-view";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { countContacts, listContacts } from "@/lib/contacts";
import { pluralize } from "@/lib/format";

const CONTACT_WORDS: [string, string, string] = ["контакт", "контакта", "контактов"];

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 pb-16">
      {/* On phones the button goes full width under the heading, as on the landing */}
      <div className="flex flex-col gap-4 pt-8 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-heading text-3xl font-bold tracking-heading sm:text-4xl">Контакты</h1>
        <Link href="/contacts/new" className={buttonVariants({ size: "lg" })}>
          <PlusIcon />
          Добавить контакт
        </Link>
      </div>
      <Suspense fallback={<ContactsFallback />}>
        <Contacts searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function firstValue(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

async function Contacts({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const params = await searchParams;
  const query = firstValue(params.q).trim();
  const addedId = Number.parseInt(firstValue(params.added), 10) || undefined;
  const deletedName = firstValue(params.deleted);

  const [contacts, total] = await Promise.all([listContacts(query), countContacts()]);

  return (
    <>
      {deletedName && (
        <p
          role="status"
          className="mb-3 rounded-lg bg-accent-soft px-4 py-3 text-base ring-1 ring-accent/25"
        >
          Контакт «{deletedName}» удалён
        </p>
      )}

      <div className="sticky top-0 z-10 -mx-6 bg-background/90 px-6 pt-2 pb-3 backdrop-blur-md">
        <ContactSearch defaultValue={query} />
        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
          {query
            ? `Найдено: ${contacts.length} из ${total}`
            : pluralize(total, CONTACT_WORDS)}
        </p>
      </div>

      {total === 0 ? (
        <NoContacts />
      ) : contacts.length === 0 ? (
        <NothingFound query={query} />
      ) : (
        <ContactList contacts={contacts} highlightId={addedId} />
      )}

      {addedId && <ScrollIntoView elementId={contactRowId(addedId)} />}
    </>
  );
}

function ContactsFallback() {
  return (
    <>
      <div className="pt-2 pb-3">
        <div className="h-12 rounded-lg border border-input bg-card" />
        <p className="mt-2 text-sm text-muted-foreground">&nbsp;</p>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-xl bg-card py-16 text-base text-muted-foreground ring-1 ring-foreground/10">
        <Spinner />
        Загружаю контакты…
      </div>
    </>
  );
}

function NoContacts() {
  return (
    <Empty className="bg-card ring-1 ring-foreground/10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UsersIcon />
        </EmptyMedia>
        <EmptyTitle>Пока нет ни одного контакта</EmptyTitle>
        <EmptyDescription>Добавьте первого человека — он появится в этом списке.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link href="/contacts/new" className={buttonVariants()}>
          <PlusIcon />
          Добавить контакт
        </Link>
      </EmptyContent>
    </Empty>
  );
}

function NothingFound({ query }: { query: string }) {
  return (
    <Empty className="bg-card ring-1 ring-foreground/10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchXIcon />
        </EmptyMedia>
        <EmptyTitle>Никого не нашли</EmptyTitle>
        <EmptyDescription>
          По запросу «{query}» нет контактов. Проверьте написание имени.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
