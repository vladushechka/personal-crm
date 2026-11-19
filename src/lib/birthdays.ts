// Birthday rules: the nearest birthday, how many days are left, what the block and the card say.
// Pure functions, "now" is a parameter. Shared by the server and the browser

import { pluralize } from "./format";

// A day of the calendar, without time: month 1-12
export type CalendarDate = { year: number; month: number; day: number };

// Day and month are always set together, the year is optional
export type Birthday = { day: number; month: number; year: number | null };

export type ContactWithBirthday = { id: number; name: string; birthday: Birthday };

// The block shows birthdays today and in the next 7 days
export const UPCOMING_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const moscowDateParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

// Today's date in Moscow, whatever the time zone of the server (UTC) or of the viewer
export function moscowToday(now: Date): CalendarDate {
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(moscowDateParts.formatToParts(now).find((p) => p.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day") };
}

function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(month: number, year: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function daysBetween(from: CalendarDate, to: CalendarDate) {
  return (
    (Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)) /
    DAY_MS
  );
}

// The birthday in a given year: 29 February is 28 February in a non-leap year
function birthdayIn(year: number, { day, month }: Pick<Birthday, "day" | "month">): CalendarDate {
  const leapDayMoved = month === 2 && day === 29 && !isLeapYear(year);
  return { year, month, day: leapDayMoved ? 28 : day };
}

// The nearest birthday from today on, and how many days are left: 0 is today
export function nextBirthday(
  birthday: Pick<Birthday, "day" | "month">,
  today: CalendarDate,
): { date: CalendarDate; inDays: number } {
  let date = birthdayIn(today.year, birthday);
  if (daysBetween(today, date) < 0) date = birthdayIn(today.year + 1, birthday);
  return { date, inDays: daysBetween(today, date) };
}

// Whose birthday is today or in the next 7 days: the nearest first, on the same day by name
export function pickUpcomingBirthdays<T extends ContactWithBirthday>(
  contacts: T[],
  now: Date,
): T[] {
  const today = moscowToday(now);
  return contacts
    .map((contact) => ({ contact, inDays: nextBirthday(contact.birthday, today).inDays }))
    .filter(({ inDays }) => inDays <= UPCOMING_DAYS)
    .sort(
      (a, b) =>
        a.inDays - b.inDays ||
        a.contact.name.localeCompare(b.contact.name, "ru") ||
        a.contact.id - b.contact.id,
    )
    .map(({ contact }) => contact);
}

// "24 ноября": the month in the genitive, as in a date
export const monthNamesGenitive = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

function dayAndMonth({ day, month }: Pick<CalendarDate, "day" | "month">) {
  return `${day} ${monthNamesGenitive[month - 1]}`;
}

// A row of the block: "Сегодня, 18 ноября · исполняется 35", "Завтра, 19 ноября",
// "24 ноября, через 6 дней · исполнится 36"
export function describeBirthday(birthday: Birthday, today: CalendarDate): string {
  const { date, inDays } = nextBirthday(birthday, today);
  const when =
    inDays === 0
      ? `Сегодня, ${dayAndMonth(date)}`
      : inDays === 1
        ? `Завтра, ${dayAndMonth(date)}`
        : `${dayAndMonth(date)}, через ${pluralize(inDays, ["день", "дня", "дней"])}`;
  if (birthday.year === null) return when;
  const age = date.year - birthday.year;
  return `${when} · ${inDays === 0 ? "исполняется" : "исполнится"} ${age}`;
}

// The card: "24 ноября 1990 г." or "24 ноября" without a year
export function formatBirthday(birthday: Birthday): string {
  const date = dayAndMonth(birthday);
  return birthday.year === null ? date : `${date} ${birthday.year} г.`;
}

// The oldest year of birth the form accepts
export const MIN_BIRTH_YEAR = 1900;

function compareDates(a: CalendarDate, b: CalendarDate) {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

// What is wrong with the birthday typed in the form, or null if it is fine or not given.
// Takes the raw text of the three fields: the server can get anything, not only the form's options
export function birthdayError(
  dayText: string,
  monthText: string,
  yearText: string,
  today: CalendarDate,
): string | null {
  if (dayText === "" && monthText === "" && yearText === "") return null;
  if (dayText === "" || monthText === "") return "Укажите день и месяц";

  const day = /^\d{1,2}$/.test(dayText) ? Number(dayText) : NaN;
  const month = /^\d{1,2}$/.test(monthText) ? Number(monthText) : NaN;
  if (!(day >= 1 && day <= 31 && month >= 1 && month <= 12)) return "Такой даты нет";

  if (yearText !== "" && !(/^\d{4}$/.test(yearText) && Number(yearText) >= MIN_BIRTH_YEAR)) {
    return "Год — четыре цифры, от 1900";
  }

  // Without a year, 29 February is a real birthday: 2000 is a leap year
  const year = yearText === "" ? null : Number(yearText);
  if (day > daysInMonth(month, year ?? 2000)) return "Такой даты нет";

  if (year !== null && compareDates({ year, month, day }, today) > 0) {
    return "Дата рождения в будущем";
  }
  return null;
}
