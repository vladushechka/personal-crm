"use client";

import Link from "next/link";
import { useActionState, useId } from "react";

import type { ContactFormAction, ContactFormState } from "@/app/actions";
import { BirthdayFields } from "@/components/birthday-fields";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { ContactField } from "@/lib/contact-schema";

type FieldConfig = {
  name: Exclude<ContactField, "birthdayDay" | "birthdayMonth" | "birthdayYear">;
  label: string;
  type?: "text" | "tel" | "email";
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
};

const FIELDS: FieldConfig[] = [
  {
    name: "name",
    label: "Имя",
    placeholder: "Например: Анна Смирнова",
    autoComplete: "off",
    required: true,
  },
  { name: "about", label: "Кто это", placeholder: "Например: бывшая коллега, дизайнер" },
  {
    name: "howWeMet",
    label: "Откуда знакомы",
    placeholder: "Например: учились вместе в университете",
  },
  {
    name: "phone",
    label: "Телефон",
    type: "tel",
    placeholder: "+7 900 123-45-67",
    autoComplete: "off",
  },
  {
    name: "email",
    label: "Почта",
    type: "email",
    placeholder: "anna@example.com",
    autoComplete: "off",
  },
];

const initialState: ContactFormState = {};

// Used both for adding a new contact and for editing an existing one
export function ContactForm({
  action,
  defaultValues,
  submitLabel,
  cancelHref,
}: {
  action: ContactFormAction;
  // Current values of the contact being edited
  defaultValues?: Partial<Record<ContactField, string>>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  // Next.js keeps visited pages in the document (hidden), so the add and edit forms can be
  // there at the same time: unique ids keep each label tied to its own input
  const idPrefix = useId();
  // Submitted values after a failed save, otherwise the contact's current values
  const valueOf = (field: ContactField) => state.values?.[field] ?? defaultValues?.[field] ?? "";

  return (
    <form action={formAction}>
      <FieldGroup>
        {FIELDS.map((field) => {
          const error = state.errors?.[field.name];
          const id = `${idPrefix}-${field.name}`;
          return (
            <Field key={field.name} data-invalid={Boolean(error)}>
              <FieldLabel htmlFor={id}>
                {field.label}
                {field.required && <span className="text-destructive">*</span>}
              </FieldLabel>
              <Input
                id={id}
                name={field.name}
                type={field.type ?? "text"}
                placeholder={field.placeholder}
                autoComplete={field.autoComplete}
                required={field.required}
                autoFocus={field.name === "name"}
                defaultValue={valueOf(field.name)}
                aria-invalid={Boolean(error)}
              />
              <FieldError>{error}</FieldError>
            </Field>
          );
        })}
        <BirthdayFields
          idPrefix={idPrefix}
          values={{
            day: valueOf("birthdayDay"),
            month: valueOf("birthdayMonth"),
            year: valueOf("birthdayYear"),
          }}
          error={state.errors?.birthday}
        />
        <FieldDescription>
          Обязательно только имя. Остальное можно заполнить позже.
        </FieldDescription>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <Spinner />}
            {submitLabel}
          </Button>
          <Link href={cancelHref} className={buttonVariants({ variant: "outline", size: "lg" })}>
            Отмена
          </Link>
        </div>
      </FieldGroup>
    </form>
  );
}
