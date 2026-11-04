// Shared by the server and the browser, so it imports only types from the database schema
import type { KeepInTouchFrequency } from "@/db/schema";

export const frequencyLabels = {
  week: "Раз в неделю",
  month: "Раз в месяц",
  quarter: "Раз в квартал",
  year: "Раз в год",
} satisfies Record<KeepInTouchFrequency, string>;

export const frequencies = Object.keys(frequencyLabels) as [
  KeepInTouchFrequency,
  ...KeepInTouchFrequency[],
];

// How many contacts the "Пора связаться" block shows before "Показать всех"
export const REACH_OUT_PREVIEW_COUNT = 5;
