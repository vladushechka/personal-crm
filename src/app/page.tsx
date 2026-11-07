import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon, SearchXIcon, UsersIcon } from "lucide-react";

import { ContactList, contactRowId } from "@/components/contact-list";
import { ContactSearch } from "@/components/contact-search";
import { GroupFilter } from "@/components/group-filter";
import { ReachOutBlock, type ReachOutRow } from "@/components/reach-out-block";
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
import {
  countContacts,
  listContacts,
  listContactsToReachOut,
  type ContactToReachOut,
} from "@/lib/contacts";
import { formatDate, pluralize } from "@/lib/format";
import { listGroupNamesByContact, listGroups } from "@/lib/groups";
import { frequencyLabels } from "@/lib/keep-in-touch";

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

  const groups = await listGroups();
  // The address of a group deleted meanwhile just shows all contacts
  const group = groups.find(({ id }) => String(id) === firstValue(params.group));

  // The "Пора связаться" block covers the whole list, so it is hidden while narrowing it down
  const [contacts, allContactsCount, groupNames, toReachOut] = await Promise.all([
    listContacts(query, group?.id),
    countContacts(),
    listGroupNamesByContact(),
    query || group ? [] : listContactsToReachOut(),
  ]);
  const total = group ? group.contactCount : allContactsCount;
  const rows = contacts.map((contact) => ({
    ...contact,
    groupNames: groupNames.get(contact.id) ?? [],
  }));

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

      {groups.length > 0 && <GroupFilter groups={groups} selectedId={group?.id} query={query} />}

      {toReachOut.length > 0 && <ReachOutBlock rows={toReachOut.map(toReachOutRow)} />}

      <div className="sticky top-0 z-10 -mx-6 bg-background/90 px-6 pt-2 pb-3 backdrop-blur-md">
        <ContactSearch defaultValue={query} groupId={group?.id} />
        <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
          {query ? `Найдено: ${contacts.length} из ${total}` : pluralize(total, CONTACT_WORDS)}
        </p>
      </div>

      {allContactsCount === 0 ? (
        <NoContacts />
      ) : total === 0 ? (
        <EmptyGroup />
      ) : contacts.length === 0 ? (
        <NothingFound query={query} />
      ) : (
        <ContactList contacts={rows} highlightId={addedId} />
      )}

      {addedId && <ScrollIntoView elementId={contactRowId(addedId)} />}
    </>
  );
}

// Dates are formatted here, on the server, so the browser shows the same text
function toReachOutRow(contact: ContactToReachOut): ReachOutRow {
  const lastTalk = contact.lastNoteAt
    ? `последняя заметка ${formatDate(contact.lastNoteAt)}`
    : `заметок нет, частота задана ${formatDate(contact.since)}`;
  return {
    id: contact.id,
    name: contact.name,
    details: `${frequencyLabels[contact.frequency]} · ${lastTalk}`,
  };
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

function EmptyGroup() {
  return (
    <Empty className="bg-card ring-1 ring-foreground/10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <UsersIcon />
        </EmptyMedia>
        <EmptyTitle>В этой группе пока никого</EmptyTitle>
        <EmptyDescription>Людей в группу добавляют в карточке контакта.</EmptyDescription>
      </EmptyHeader>
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
