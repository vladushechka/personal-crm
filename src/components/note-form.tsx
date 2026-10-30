"use client";

import { useActionState, useRef } from "react";

import type { NoteFormState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const initialState: NoteFormState = {};

export function NoteForm({
  action,
}: {
  action: (prevState: NoteFormState, formData: FormData) => Promise<NoteFormState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const submitButton = useRef<HTMLButtonElement>(null);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field data-invalid={Boolean(state.error)}>
        <FieldLabel htmlFor="note-body">Новая заметка</FieldLabel>
        <Textarea
          id="note-body"
          name="body"
          required
          rows={3}
          className="min-h-24 bg-card"
          placeholder="О чём поговорили, о чём договорились"
          defaultValue={state.body}
          aria-invalid={Boolean(state.error)}
          onKeyDown={(event) => {
            // Ctrl+Enter (Cmd+Enter on Mac) presses the save button. While a note is saving the
            // button is disabled, so pressing it again doesn't save the note twice
            if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
              event.preventDefault();
              submitButton.current?.click();
            }
          }}
        />
        <FieldError>{state.error}</FieldError>
      </Field>
      <div className="flex items-center gap-3">
        <Button ref={submitButton} type="submit" disabled={pending}>
          {pending && <Spinner />}
          Сохранить заметку
        </Button>
        <span className="text-sm text-muted-foreground">или Ctrl+Enter</span>
      </div>
    </form>
  );
}
