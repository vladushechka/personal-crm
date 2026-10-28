"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { z } from "zod";

import {
  contactFields,
  contactInputSchema,
  noteInputSchema,
  type ContactField,
  type ContactInput,
} from "@/lib/contact-schema";
import {
  addNote,
  contactExists,
  createContact,
  deleteContact,
  updateContact,
} from "@/lib/contacts";

const contactIdSchema = z.number().int().positive();

export type ContactFormState = {
  errors?: Partial<Record<ContactField, string>>;
  // Submitted values, so the form keeps them when validation fails
  values?: Partial<Record<ContactField, string>>;
};

export type ContactFormAction = (
  prevState: ContactFormState,
  formData: FormData,
) => Promise<ContactFormState>;

// Adding and editing a contact share the same validation rules
function parseContactForm(
  formData: FormData,
): { data: ContactInput; invalid?: never } | { data?: never; invalid: ContactFormState } {
  const values = Object.fromEntries(
    contactFields.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as Record<ContactField, string>;

  const parsed = contactInputSchema.safeParse(values);
  if (parsed.success) return { data: parsed.data };

  const errors: Partial<Record<ContactField, string>> = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as ContactField;
    errors[field] ??= issue.message;
  }
  return { invalid: { errors, values } };
}

export async function createContactAction(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const { data, invalid } = parseContactForm(formData);
  if (invalid) return invalid;

  const id = await createContact(data);

  revalidatePath("/");
  redirect(`/?added=${id}`);
}

export async function updateContactAction(
  contactId: number,
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const { data, invalid } = parseContactForm(formData);
  if (invalid) return invalid;

  const updated =
    contactIdSchema.safeParse(contactId).success && (await updateContact(contactId, data));

  revalidatePath("/");
  // Replace the form in the browser history, so "Back" from the card doesn't reopen it.
  // Deleted meanwhile (e.g. in another browser): the card address shows "not found"
  redirect(
    updated ? `/contacts/${contactId}?saved=1` : `/contacts/${contactId}`,
    RedirectType.replace,
  );
}

export type NoteFormState = {
  error?: string;
  // Submitted text, so the form keeps it when saving fails
  body?: string;
};

export async function addNoteAction(
  contactId: number,
  _prevState: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  const body = String(formData.get("body") ?? "");

  if (!contactIdSchema.safeParse(contactId).success || !(await contactExists(contactId))) {
    return { error: "Контакт не найден", body };
  }

  const parsed = noteInputSchema.safeParse({ body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, body };
  }

  await addNote(contactId, parsed.data.body);

  refresh();
  return {};
}

export async function deleteContactAction(contactId: number): Promise<void> {
  const deletedName = contactIdSchema.safeParse(contactId).success
    ? await deleteContact(contactId)
    : null;

  revalidatePath("/");
  // Already deleted (e.g. in another browser): just go back to the list
  redirect(deletedName ? `/?deleted=${encodeURIComponent(deletedName)}` : "/");
}
