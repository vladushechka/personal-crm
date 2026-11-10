"use client";

import { useActionState, useState } from "react";

import type { SignInFormState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type SignInAction = (prevState: SignInFormState, formData: FormData) => Promise<SignInFormState>;

const initialState: SignInFormState = {};

export function SignInForm({ action }: { action: SignInAction }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  if (state.sentTo) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p role="status" className="w-full rounded-lg bg-card px-4 py-3 ring-1 ring-foreground/10">
          Ссылка для входа отправлена на {state.sentTo}
        </p>
        {/* A new email resets the help, an error keeps it open */}
        <SendAgain
          key={state.sentAt}
          email={state.sentTo}
          sentAt={state.sentAt}
          error={state.error}
          formAction={formAction}
          pending={pending}
        />
      </div>
    );
  }

  return (
    // The server checks the address: its message is the same for every mistake
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <Field data-invalid={Boolean(state.error)}>
        <FieldLabel htmlFor="sign-in-email">Почта</FieldLabel>
        <Input
          id="sign-in-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          placeholder="anna@example.com"
          defaultValue={state.email}
          aria-invalid={Boolean(state.error)}
        />
        <FieldError>{state.error}</FieldError>
      </Field>
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Spinner />}
        Получить ссылку
      </Button>
    </form>
  );
}

// «Не пришла ссылка?»: hidden at first, so the button doesn't tempt to press it again
function SendAgain({
  email,
  sentAt,
  error,
  formAction,
  pending,
}: {
  email: string;
  sentAt?: number;
  error?: string;
  formAction: (formData: FormData) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(Boolean(error));

  if (!open) {
    return (
      <button
        type="button"
        className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        Не пришла ссылка?
      </button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">Проверьте папку «Спам».</p>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="sentAt" value={sentAt ?? ""} />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending && <Spinner />}
        Отправить ещё раз
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
