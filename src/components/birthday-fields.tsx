"use client";

import { FieldDescription, FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { monthNamesGenitive } from "@/lib/birthdays";

type Item = { value: string; label: string };

// "" is "—": the part is not chosen, the value the server expects for "no birthday"
const NOT_CHOSEN: Item = { value: "", label: "—" };

const dayItems: Item[] = [
  NOT_CHOSEN,
  ...Array.from({ length: 31 }, (_, index) => ({
    value: String(index + 1),
    label: String(index + 1),
  })),
];

const monthItems: Item[] = [
  NOT_CHOSEN,
  ...monthNamesGenitive.map((name, index) => ({ value: String(index + 1), label: name })),
];

// One list of the birthday: its value goes with the form under `name`
function BirthdaySelect({
  name,
  label,
  items,
  defaultValue,
  invalid,
  describedBy,
  className,
}: {
  name: string;
  label: string;
  items: Item[];
  defaultValue: string;
  invalid: boolean;
  describedBy?: string;
  className: string;
}) {
  return (
    <Select name={name} items={items} defaultValue={defaultValue}>
      <SelectTrigger
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        // The trigger's own default height is data-[size=default]:h-8, so plain h-10 loses to it
        className={`text-base data-[size=default]:h-10 ${className}`}
      >
        {/* Not chosen: the trigger shows what the list is for, "День" or "Месяц" */}
        <SelectValue>
          {(value: string) =>
            value ? (
              items.find((item) => item.value === value)?.label
            ) : (
              <span className="text-muted-foreground/70">{label}</span>
            )
          }
        </SelectValue>
      </SelectTrigger>
      {/* The list opens under the field, not over the form */}
      <SelectContent alignItemWithTrigger={false} className="max-h-72">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// "День рождения" in the contact form: day and month lists and the year, in one row
export function BirthdayFields({
  idPrefix,
  values,
  error,
}: {
  idPrefix: string;
  values: { day: string; month: string; year: string };
  error?: string;
}) {
  const invalid = Boolean(error);
  const hintId = `${idPrefix}-birthday-hint`;
  const errorId = `${idPrefix}-birthday-error`;
  const describedBy = invalid ? `${hintId} ${errorId}` : hintId;

  return (
    <FieldSet data-invalid={invalid} className="gap-2">
      <FieldLegend variant="label" className="mb-0">
        День рождения
      </FieldLegend>
      <div className="flex gap-2">
        <BirthdaySelect
          name="birthdayDay"
          label="День"
          items={dayItems}
          defaultValue={values.day}
          invalid={invalid}
          describedBy={describedBy}
          className="w-22 shrink-0"
        />
        <BirthdaySelect
          name="birthdayMonth"
          label="Месяц"
          items={monthItems}
          defaultValue={values.month}
          invalid={invalid}
          describedBy={describedBy}
          className="min-w-0 flex-1"
        />
        <Input
          name="birthdayYear"
          aria-label="Год"
          placeholder="Год"
          inputMode="numeric"
          maxLength={4}
          autoComplete="off"
          defaultValue={values.year}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="w-22 shrink-0"
        />
      </div>
      <FieldDescription id={hintId}>Год, если знаете</FieldDescription>
      <FieldError id={errorId}>{error}</FieldError>
    </FieldSet>
  );
}
