import { z } from "zod";

// An email for signing in: no spaces at the ends, lower case. "Anna@Example.com " and
// "anna@example.com" are the same person
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Проверь адрес почты" }));
