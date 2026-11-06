"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { PencilIcon } from "lucide-react";

import type { RenameGroupState } from "@/app/actions";
import { DeleteGroupButton } from "@/components/delete-group-button";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type RenameAction = (
  prevState: RenameGroupState,
  formData: FormData,
) => Promise<RenameGroupState>;

// One group on the "Группы" page: its name, or a form to rename it in place
export function GroupRow({
  name,
  contactCountLabel,
  renameAction,
  deleteAction,
}: {
  name: string;
  contactCountLabel: string;
  renameAction: RenameAction;
  deleteAction: () => Promise<void>;
}) {
  const [renaming, setRenaming] = useState(false);

  if (renaming) {
    return (
      <RenameGroupForm name={name} action={renameAction} onClose={() => setRenaming(false)} />
    );
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-base font-semibold break-words">{name}</p>
        <p className="text-sm text-muted-foreground">{contactCountLabel}</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Переименовать группу"
          title="Переименовать"
          onClick={() => setRenaming(true)}
        >
          <PencilIcon />
        </Button>
        <DeleteGroupButton name={name} action={deleteAction} />
      </div>
    </div>
  );
}

const initialState: RenameGroupState = {};

// Mounted anew for every rename, so a failed save from last time doesn't show up again
function RenameGroupForm({
  name,
  action,
  onClose,
}: {
  name: string;
  action: RenameAction;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<RenameGroupState, FormData>(
    async (prevState, formData) => {
      const result = await action(prevState, formData);
      if (result.saved) startTransition(onClose);
      return result;
    },
    initialState,
  );
  // Next.js keeps hidden copies of visited pages, so a fixed id could point at another copy
  const fieldId = useId();

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field data-invalid={Boolean(state.error)}>
        <FieldLabel htmlFor={fieldId}>Название группы</FieldLabel>
        <Input
          id={fieldId}
          name="name"
          required
          autoComplete="off"
          defaultValue={state.name ?? name}
          aria-invalid={Boolean(state.error)}
          autoFocus
          onKeyDown={(event) => {
            if (event.key === "Escape" && !pending) {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <FieldError>{state.error}</FieldError>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending && <Spinner />}
          Сохранить
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
