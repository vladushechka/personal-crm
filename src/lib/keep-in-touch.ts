// Shared by the server and the browser, so it imports only types from the database schema
import type { KeepInTouchFrequency } from "@/db/schema";

import { formatDate } from "./format";

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

export type ContactToReachOut = {
  id: number;
  name: string;
  frequency: KeepInTouchFrequency;
  lastNoteAt: Date | null;
  // When the current frequency was chosen
  since: Date;
};

const monthsIn = { month: 1, quarter: 3, year: 12 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

// When it is time to talk again after the last talk. A week is 7 days; months, quarters and
// years are calendar ones, counted in UTC: a month after 31 January is the end of February
export function dueAt(lastTalkAt: Date, frequency: KeepInTouchFrequency): Date {
  if (frequency === "week") return new Date(lastTalkAt.getTime() + 7 * DAY_MS);

  const due = new Date(lastTalkAt);
  const day = due.getUTCDate();
  due.setUTCDate(1);
  due.setUTCMonth(due.getUTCMonth() + monthsIn[frequency]);
  const daysInMonth = new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0));
  due.setUTCDate(Math.min(day, daysInMonth.getUTCDate()));
  return due;
}

// The last talk is the latest note, or the day the frequency was chosen if there are no notes
function lastTalkAt(contact: ContactToReachOut) {
  return contact.lastNoteAt ?? contact.since;
}

// Contacts whose time to talk has passed: the earliest due date, i.e. the most overdue, first
export function pickContactsToReachOut<T extends ContactToReachOut>(contacts: T[], now: Date): T[] {
  return contacts
    .map((contact) => ({ contact, due: dueAt(lastTalkAt(contact), contact.frequency) }))
    .filter(({ due }) => due < now)
    .sort(
      (a, b) =>
        a.due.getTime() - b.due.getTime() ||
        a.contact.name.localeCompare(b.contact.name, "ru") ||
        a.contact.id - b.contact.id,
    )
    .map(({ contact }) => contact);
}

// A row of the block: "Раз в месяц · последняя заметка 3 апреля 2026 г."
export function describeReachOut(contact: ContactToReachOut): string {
  const lastTalk = contact.lastNoteAt
    ? `последняя заметка ${formatDate(contact.lastNoteAt)}`
    : `заметок нет, частота задана ${formatDate(contact.since)}`;
  return `${frequencyLabels[contact.frequency]} · ${lastTalk}`;
}
