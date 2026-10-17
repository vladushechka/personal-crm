"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  contactFields,
  contactInputSchema,
  noteInputSchema,
  type ContactField,
} from "@/lib/contact-schema";
import { addNote, contactExists, createContact, deleteContact } from "@/lib/contacts";

export type ContactFormState = {
  errors?: Partial<Record<ContactField, string>>;
  // Submitted values, so the form keeps them when validation fails
  values?: Partial<Record<ContactField, string>>;
};

export async function createContactAction(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const values = Object.fromEntries(
    contactFields.map((field) => [field, String(formData.get(field) ?? "")]),
  ) as Record<ContactField, string>;

  const parsed = contactInputSchema.safeParse(values);
  if (!parsed.success) {
    const errors: Partial<Record<ContactField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as ContactField;
      errors[field] ??= issue.message;
    }
    return { errors, values };
  }

  const id = await createContact(parsed.data);

  revalidatePath("/");
  redirect(`/?added=${id}`);
}

export type NoteFormState = {
  error?: string;
  // Submitted text, so the form keeps it when saving fails
  body?: string;
};

const contactIdSchema = z.number().int().positive();

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
