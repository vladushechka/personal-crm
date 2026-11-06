import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { TagsIcon } from "lucide-react";

import { deleteGroupAction, renameGroupAction } from "@/app/actions";
import { BackLink } from "@/components/back-link";
import { GroupRow } from "@/components/group-row";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { pluralize } from "@/lib/format";
import { listGroups } from "@/lib/groups";

export const metadata: Metadata = { title: "Группы · Personal CRM" };

export default function GroupsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-6">
      <BackLink />
      <h1 className="mt-3 font-heading text-3xl font-bold tracking-heading sm:text-4xl">Группы</h1>
      <Suspense fallback={<GroupsFallback />}>
        <Groups />
      </Suspense>
    </main>
  );
}

async function Groups() {
  // Read on every request: the build has no database
  await connection();
  const groups = await listGroups();

  if (groups.length === 0) return <NoGroups />;

  return (
    <ul className="mt-6 divide-y divide-glass-border rounded-xl bg-card px-5 ring-1 ring-foreground/10 sm:px-6">
      {groups.map((group) => (
        <li key={group.id} className="py-4" data-testid="group-row">
          <GroupRow
            name={group.name}
            contactCountLabel={pluralize(group.contactCount, ["контакт", "контакта", "контактов"])}
            renameAction={renameGroupAction.bind(null, group.id)}
            deleteAction={deleteGroupAction.bind(null, group.id)}
          />
        </li>
      ))}
    </ul>
  );
}

function NoGroups() {
  return (
    <Empty className="mt-6 bg-card ring-1 ring-foreground/10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <TagsIcon />
        </EmptyMedia>
        <EmptyTitle>Групп пока нет</EmptyTitle>
        <EmptyDescription>Группы создаются в карточке контакта.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function GroupsFallback() {
  return (
    <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-card py-16 text-base text-muted-foreground ring-1 ring-foreground/10">
      <Spinner />
      Загружаю группы…
    </div>
  );
}
