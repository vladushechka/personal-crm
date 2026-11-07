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
  deleteNote,
  setKeepInTouch,
  updateContact,
  updateNote,
} from "@/lib/contacts";
import { groupNameSchema } from "@/lib/group-schema";
import {
  addContactToGroup,
  addContactToNamedGroup,
  deleteGroup,
  groupExists,
  removeContactFromGroup,
  renameGroup,
} from "@/lib/groups";
import { frequencies } from "@/lib/keep-in-touch";

const contactIdSchema = z.number().int().positive();
const noteIdSchema = z.number().int().positive();
const groupIdSchema = z.number().int().positive();
// "" is "Не задано" in the form
const frequencyInputSchema = z
  .union([z.literal(""), z.enum(frequencies)])
  .transform((value) => (value === "" ? null : value));

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

  // A note restarts the countdown in the "Пора связаться" block on the list
  revalidatePath("/");
  refresh();
  return {};
}

export type EditNoteState = NoteFormState & {
  // Tells the form to close: the note is saved
  saved?: boolean;
};

export async function updateNoteAction(
  contactId: number,
  noteId: number,
  _prevState: EditNoteState,
  formData: FormData,
): Promise<EditNoteState> {
  const body = String(formData.get("body") ?? "");

  const parsed = noteInputSchema.safeParse({ body });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, body };
  }

  const updated =
    contactIdSchema.safeParse(contactId).success &&
    noteIdSchema.safeParse(noteId).success &&
    (await updateNote(contactId, noteId, parsed.data.body));
  if (!updated) {
    return { error: "Заметка не найдена", body };
  }

  refresh();
  return { saved: true };
}

export async function deleteNoteAction(contactId: number, noteId: number): Promise<void> {
  // Already deleted (e.g. in another browser): the refreshed card just doesn't show it
  if (contactIdSchema.safeParse(contactId).success && noteIdSchema.safeParse(noteId).success) {
    await deleteNote(contactId, noteId);
  }
  // Deleting the latest note can bring the contact back to the "Пора связаться" block
  revalidatePath("/");
  refresh();
}

export type KeepInTouchState = {
  error?: string;
};

export async function setKeepInTouchAction(
  contactId: number,
  _prevState: KeepInTouchState,
  formData: FormData,
): Promise<KeepInTouchState> {
  const parsed = frequencyInputSchema.safeParse(formData.get("frequency") ?? "");
  if (!parsed.success) {
    return { error: "Неизвестная частота" };
  }

  const updated =
    contactIdSchema.safeParse(contactId).success && (await setKeepInTouch(contactId, parsed.data));
  if (!updated) {
    return { error: "Контакт не найден" };
  }

  // The "Пора связаться" block on the list depends on it
  revalidatePath("/");
  refresh();
  return {};
}

export type ContactGroupState = {
  error?: string;
};

export async function setContactGroupAction(
  contactId: number,
  groupId: number,
  inGroup: boolean,
): Promise<ContactGroupState> {
  if (!contactIdSchema.safeParse(contactId).success || !(await contactExists(contactId))) {
    return { error: "Контакт не найден" };
  }
  if (!groupIdSchema.safeParse(groupId).success || !(await groupExists(groupId))) {
    return { error: "Группа не найдена" };
  }

  if (inGroup) {
    await addContactToGroup(contactId, groupId);
  } else {
    await removeContactFromGroup(contactId, groupId);
  }

  // The list shows a contact's groups and how many people each group has
  revalidatePath("/");
  refresh();
  return {};
}

export type NewGroupState = {
  error?: string;
  // Submitted text, so the form keeps it when saving fails
  name?: string;
};

export async function addContactToNewGroupAction(
  contactId: number,
  _prevState: NewGroupState,
  formData: FormData,
): Promise<NewGroupState> {
  const name = String(formData.get("name") ?? "");

  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, name };
  }
  if (!contactIdSchema.safeParse(contactId).success || !(await contactExists(contactId))) {
    return { error: "Контакт не найден", name };
  }

  await addContactToNamedGroup(contactId, parsed.data);

  revalidatePath("/");
  refresh();
  return {};
}

export type RenameGroupState = {
  error?: string;
  // Submitted text, so the form keeps it when saving fails
  name?: string;
  // Tells the form to close: the name is saved
  saved?: boolean;
};

export async function renameGroupAction(
  groupId: number,
  _prevState: RenameGroupState,
  formData: FormData,
): Promise<RenameGroupState> {
  const name = String(formData.get("name") ?? "");

  const parsed = groupNameSchema.safeParse(name);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message, name };
  }

  const result = groupIdSchema.safeParse(groupId).success
    ? await renameGroup(groupId, parsed.data)
    : "not-found";
  if (result === "taken") return { error: "Такая группа уже есть", name };
  if (result === "not-found") return { error: "Группа не найдена", name };

  revalidatePath("/");
  refresh();
  return { saved: true };
}

export async function deleteGroupAction(groupId: number): Promise<void> {
  // Already deleted (e.g. in another browser): the refreshed page just doesn't show it
  if (groupIdSchema.safeParse(groupId).success) {
    await deleteGroup(groupId);
  }
  revalidatePath("/");
  refresh();
}

export async function deleteContactAction(contactId: number): Promise<void> {
  const deletedName = contactIdSchema.safeParse(contactId).success
    ? await deleteContact(contactId)
    : null;

  revalidatePath("/");
  // Already deleted (e.g. in another browser): just go back to the list
  redirect(deletedName ? `/?deleted=${encodeURIComponent(deletedName)}` : "/");
}
