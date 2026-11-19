import { z } from "zod";

import { birthdayError, moscowToday } from "./birthdays";

// Validation rules for user input. Messages are shown in the UI, so they are in Russian.

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Слишком длинно: не больше ${max} символов`)
    .transform((value) => (value === "" ? null : value));
}

// Text of a birthday field: a number, or "" if not chosen
function birthdayPart(text: string) {
  return text === "" ? null : Number(text);
}

export const contactInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Укажите имя")
      .max(200, "Слишком длинно: не больше 200 символов"),
    about: optionalText(500),
    howWeMet: optionalText(500),
    phone: optionalText(50),
    email: z
      .string()
      .trim()
      .max(254, "Слишком длинно: не больше 254 символов")
      .refine((value) => value === "" || z.email().safeParse(value).success, {
        message: "Похоже, в адресе почты опечатка",
      })
      .transform((value) => (value === "" ? null : value)),
    // Three fields of one birthday, checked together below
    birthdayDay: z.string().trim(),
    birthdayMonth: z.string().trim(),
    birthdayYear: z.string().trim(),
  })
  .superRefine(({ birthdayDay, birthdayMonth, birthdayYear }, ctx) => {
    // "Today" for a date in the future is the Moscow date, like every date in the app
    const error = birthdayError(birthdayDay, birthdayMonth, birthdayYear, moscowToday(new Date()));
    if (error) ctx.addIssue({ code: "custom", path: ["birthday"], message: error });
  })
  .transform(({ birthdayDay, birthdayMonth, birthdayYear, ...contact }) => ({
    ...contact,
    birthdayDay: birthdayPart(birthdayDay),
    birthdayMonth: birthdayPart(birthdayMonth),
    birthdayYear: birthdayPart(birthdayYear),
  }));

export type ContactInput = z.output<typeof contactInputSchema>;
export type ContactField = keyof ContactInput;
// Errors are shown under a field; the three birthday fields share one error, "birthday"
export type ContactErrorKey = ContactField | "birthday";

export const contactFields = [
  "name",
  "about",
  "howWeMet",
  "phone",
  "email",
  "birthdayDay",
  "birthdayMonth",
  "birthdayYear",
] as const satisfies readonly ContactField[];

const MAX_CONTACT_ID = 2_147_483_647; // Postgres integer

// Contact id from the page address, or null if the address can't point to a contact
export function parseContactId(value: string) {
  if (!/^\d+$/.test(value)) return null;
  const id = Number(value);
  return id >= 1 && id <= MAX_CONTACT_ID ? id : null;
}

export const noteInputSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Заметка пустая")
    .max(10_000, "Слишком длинно: не больше 10 000 символов"),
});
