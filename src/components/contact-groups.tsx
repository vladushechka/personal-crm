"use client";

import Link from "next/link";
import { startTransition, useActionState, useId, useOptimistic, useState } from "react";
import { CheckIcon } from "lucide-react";

import type { ContactGroupState, NewGroupState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const initialNewGroupState: NewGroupState = {};

type GroupOption = { id: number; name: string };

// A row of the contact details list: the groups the contact is in, saved on pressing
export function ContactGroups({
  groups,
  groupIds,
  setGroupAction,
  addToNewGroupAction,
}: {
  groups: GroupOption[];
  groupIds: number[];
  setGroupAction: (groupId: number, inGroup: boolean) => Promise<ContactGroupState>;
  addToNewGroupAction: (prevState: NewGroupState, formData: FormData) => Promise<NewGroupState>;
}) {
  // Shows a press while it saves; after that the groups come from the server
  const [shownIds, showGroup] = useOptimistic(
    groupIds,
    (ids, { groupId, inGroup }: { groupId: number; inGroup: boolean }) =>
      inGroup ? [...ids, groupId] : ids.filter((id) => id !== groupId),
  );
  const [setGroupError, setSetGroupError] = useState<string>();
  const [newGroupState, newGroupFormAction, addingToNewGroup] = useActionState(
    addToNewGroupAction,
    initialNewGroupState,
  );
  // Next.js keeps hidden copies of visited pages, so a fixed id could point at another copy
  const newGroupFieldId = useId();
  const error = setGroupError ?? newGroupState.error;

  function toggle(groupId: number, inGroup: boolean) {
    startTransition(async () => {
      showGroup({ groupId, inGroup });
      const result = await setGroupAction(groupId, inGroup);
      startTransition(() => setSetGroupError(result.error));
    });
  }

  return (
    <>
      <dt className="text-sm text-muted-foreground sm:pt-2 sm:text-base">Группы</dt>
      <dd className="-mt-2 flex flex-col gap-3 sm:mt-0">
        {groups.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {groups.map((group) => {
              const inGroup = shownIds.includes(group.id);
              return (
                <button
                  key={group.id}
                  type="button"
                  aria-pressed={inGroup}
                  onClick={() => toggle(group.id, !inGroup)}
                  className={chipVariants({ active: inGroup })}
                >
                  {inGroup && <CheckIcon className="size-3.5" aria-hidden />}
                  {group.name}
                </button>
              );
            })}
            <Link
              href="/groups"
              className="text-sm text-accent underline-offset-4 hover:underline"
            >
              Все группы
            </Link>
          </div>
        )}
        <form action={newGroupFormAction} className="flex items-center gap-2">
          <label htmlFor={newGroupFieldId} className="sr-only">
            Новая группа
          </label>
          <Input
            id={newGroupFieldId}
            name="name"
            autoComplete="off"
            placeholder="Новая группа"
            defaultValue={newGroupState.name}
            aria-invalid={Boolean(newGroupState.error)}
            className="max-w-56"
          />
          <Button
            type="submit"
            variant="outline"
            aria-label="Добавить группу"
            disabled={addingToNewGroup}
          >
            {addingToNewGroup && <Spinner />}
            Добавить
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </dd>
    </>
  );
}
