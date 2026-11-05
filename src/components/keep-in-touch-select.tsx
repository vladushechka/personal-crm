"use client";

import { startTransition, useActionState, useId, useOptimistic } from "react";

import type { KeepInTouchState } from "@/app/actions";
import type { KeepInTouchFrequency } from "@/db/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { frequencies, frequencyLabels } from "@/lib/keep-in-touch";

const initialState: KeepInTouchState = {};

// "" is "Не задано", the same value the server action expects
const items = [
  { value: "", label: "Не задано" },
  ...frequencies.map((value) => ({ value, label: frequencyLabels[value] })),
];

// A row of the contact details list: "Как часто общаться" and a select that saves on change
export function KeepInTouchSelect({
  frequency,
  action,
}: {
  frequency: KeepInTouchFrequency | null;
  action: (prevState: KeepInTouchState, formData: FormData) => Promise<KeepInTouchState>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  // Shows the choice while it saves; after that the value comes from the server
  const [value, showValue] = useOptimistic<string>(frequency ?? "");
  // Next.js keeps hidden copies of visited pages, so a fixed id could point at another copy
  const labelId = useId();
  const errorId = `${labelId}-error`;

  function choose(next: string | null) {
    const formData = new FormData();
    formData.set("frequency", next ?? "");
    startTransition(() => {
      showValue(next ?? "");
      formAction(formData);
    });
  }

  return (
    <>
      <dt id={labelId} className="text-sm text-muted-foreground sm:pt-2 sm:text-base">
        Как часто общаться
      </dt>
      <dd className="-mt-2 sm:mt-0">
        <div className="flex flex-wrap items-center gap-3">
          <Select items={items} value={value} onValueChange={choose}>
            <SelectTrigger
              aria-labelledby={labelId}
              aria-invalid={Boolean(state.error)}
              aria-describedby={state.error ? errorId : undefined}
              className="h-10 min-w-44 text-base"
            >
              <SelectValue />
            </SelectTrigger>
            {/* The list opens under the field; by default it lines up the selected row with the
                field and goes up over the card */}
            <SelectContent alignItemWithTrigger={false}>
              {items.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pending && <Spinner />}
          {state.error && (
            <p id={errorId} role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
        </div>
      </dd>
    </>
  );
}
