import { z } from "zod";

// Messages are shown in the UI, so they are in Russian
export const groupNameSchema = z
  .string()
  .trim()
  .min(1, "Укажите название")
  .max(50, "Слишком длинно: не больше 50 символов");
