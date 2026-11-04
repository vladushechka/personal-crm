"use client";

import { useActionState, useId } from "react";
import { ChevronDownIcon } from "lucide-react";

import type { KeepInTouchState } from "@/app/actions";
import type { KeepInTouchFrequency } from "@/db/schema";
import { Spinner } from "@/components/ui/spinner";
import { frequencies, frequencyLabels } from "@/lib/keep-in-touch";

const initialState: KeepInTouchState = {};

// A row of the contact details list: "Как часто общаться" and a select that saves on change
export function KeepInTouchSelect({
  frequency,
  action,
}: {
  frequency: KeepInTouchFrequency | null;
  action: (prevState: KeepInTouchState, formData: FormData) => Promise<KeepInTouchState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  // Next.js keeps hidden copies of visited pages, so a fixed id could point at another copy
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <>
      <dt className="text-sm text-muted-foreground sm:pt-2 sm:text-base">
        <label htmlFor={id}>Как часто общаться</label>
      </dt>
      <dd className="-mt-2 sm:mt-0">
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              id={id}
              name="frequency"
              defaultValue={frequency ?? ""}
              disabled={pending}
              aria-invalid={Boolean(state.error)}
              aria-describedby={state.error ? errorId : undefined}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className="h-10 appearance-none rounded-lg border border-input bg-input/30 pr-9 pl-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive"
            >
              <option value="">Не задано</option>
              {frequencies.map((value) => (
                <option key={value} value={value}>
                  {frequencyLabels[value]}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
          </div>
          {pending && <Spinner />}
          {state.error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </form>
      </dd>
    </>
  );
}
