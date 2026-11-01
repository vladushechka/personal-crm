"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { PencilIcon } from "lucide-react";

import type { EditNoteState } from "@/app/actions";
import { DeleteNoteButton } from "@/components/delete-note-button";
import { Button } from "@/components/ui/button";
import { Field, FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

type UpdateNoteAction = (prevState: EditNoteState, formData: FormData) => Promise<EditNoteState>;

// One note in the contact card: its text, or a form to edit it in place
export function NoteItem({
  body,
  dateTime,
  dateLabel,
  updateAction,
  deleteAction,
}: {
  body: string;
  dateTime: string;
  dateLabel: string;
  updateAction: UpdateNoteAction;
  deleteAction: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <time dateTime={dateTime} className="text-sm font-bold text-accent">
          {dateLabel}
        </time>
        {!editing && (
          <div className="-my-1 flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Изменить заметку"
              title="Изменить"
              onClick={() => setEditing(true)}
            >
              <PencilIcon />
            </Button>
            <DeleteNoteButton body={body} action={deleteAction} />
          </div>
        )}
      </div>
      {editing ? (
        <EditNoteForm body={body} action={updateAction} onClose={() => setEditing(false)} />
      ) : (
        <p className="mt-1.5 text-base/relaxed whitespace-pre-wrap">{body}</p>
      )}
    </>
  );
}

const initialState: EditNoteState = {};

// Mounted anew for every edit, so a failed save from last time doesn't show up again
function EditNoteForm({
  body,
  action,
  onClose,
}: {
  body: string;
  action: UpdateNoteAction;
  onClose: () => void;
}) {
  const [state, formAction, pending] = useActionState<EditNoteState, FormData>(
    async (prevState, formData) => {
      const result = await action(prevState, formData);
      if (result.saved) startTransition(onClose);
      return result;
    },
    initialState,
  );
  const submitButton = useRef<HTMLButtonElement>(null);

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-3">
      <Field data-invalid={Boolean(state.error)}>
        <Textarea
          name="body"
          aria-label="Текст заметки"
          required
          rows={3}
          className="min-h-24"
          defaultValue={state.body ?? body}
          aria-invalid={Boolean(state.error)}
          autoFocus
          onFocus={(event) => {
            // Put the cursor after the text, not before it
            const end = event.currentTarget.value.length;
            event.currentTarget.setSelectionRange(end, end);
          }}
          onKeyDown={(event) => {
            // Same as the new note form: Ctrl+Enter presses the disabled-while-saving button,
            // so pressing it twice doesn't save twice
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              submitButton.current?.click();
            } else if (event.key === "Escape" && !pending) {
              event.preventDefault();
              onClose();
            }
          }}
        />
        <FieldError>{state.error}</FieldError>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button ref={submitButton} type="submit" disabled={pending}>
          {pending && <Spinner />}
          Сохранить
        </Button>
        <Button type="button" variant="outline" disabled={pending} onClick={onClose}>
          Отмена
        </Button>
        <span className="text-sm text-muted-foreground">Ctrl+Enter — сохранить, Esc — отмена</span>
      </div>
    </form>
  );
}
