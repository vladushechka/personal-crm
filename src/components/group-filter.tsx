import Link from "next/link";

import { chipVariants } from "@/components/ui/chip";
import type { GroupWithCount } from "@/lib/groups";

// Keeps the search text when another group is chosen
function listHref(groupId: number | undefined, query: string) {
  const params = new URLSearchParams();
  if (groupId) params.set("group", String(groupId));
  if (query) params.set("q", query);
  const search = params.toString();
  return search ? `/?${search}` : "/";
}

// Buttons over the contact list: all contacts or the contacts of one group
export function GroupFilter({
  groups,
  selectedId,
  query,
}: {
  groups: GroupWithCount[];
  selectedId: number | undefined;
  query: string;
}) {
  return (
    <nav aria-label="Группы" className="mb-4 flex flex-wrap items-center gap-2">
      <Link
        href={listHref(undefined, query)}
        aria-current={selectedId === undefined ? "true" : undefined}
        className={chipVariants({ active: selectedId === undefined })}
      >
        Все
      </Link>
      {groups.map((group) => (
        <Link
          key={group.id}
          href={listHref(group.id, query)}
          aria-current={group.id === selectedId ? "true" : undefined}
          className={chipVariants({ active: group.id === selectedId })}
        >
          {group.name} {group.contactCount}
        </Link>
      ))}
      <Link href="/groups" className="ml-1 text-sm text-accent underline-offset-4 hover:underline">
        Настроить
      </Link>
    </nav>
  );
}
