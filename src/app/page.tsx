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
    <main className="mx-auto w-full max-w-3xl px-4 pb-16">
      <div className="flex items-center justify-between gap-4 pt-6 pb-3">
        <h1 className="text-2xl font-semibold tracking-tight">Контакты</h1>
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
          className="mb-3 rounded-lg bg-background px-4 py-2.5 text-sm ring-1 ring-foreground/10"
        >
          Контакт «{deletedName}» удалён
        </p>
      )}

      <div className="sticky top-0 z-10 -mx-4 bg-neutral-50/90 px-4 pt-1 pb-3 backdrop-blur-md">
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
      <div className="pt-1 pb-3">
        <div className="h-10 rounded-lg border bg-background" />
        <p className="mt-2 text-sm text-muted-foreground">&nbsp;</p>
      </div>
      <div className="flex items-center justify-center gap-2 rounded-xl bg-background py-16 text-sm text-muted-foreground ring-1 ring-foreground/10">
        <Spinner />
        Загружаю контакты…
      </div>
    </>
  );
}

function NoContacts() {
  return (
    <Empty className="bg-background ring-1 ring-foreground/10">
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
    <Empty className="bg-background ring-1 ring-foreground/10">
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
