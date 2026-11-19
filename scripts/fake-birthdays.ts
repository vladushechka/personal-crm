import { daysInMonth, type Birthday } from "../src/lib/birthdays";

const CHANCE_OF_BIRTHDAY = 1 / 3;
const CHANCE_OF_YEAR = 0.7;
const FIRST_YEAR = 1950;
const LAST_YEAR = 2005;

// The birthday of one fake contact: about two thirds get none; of the rest about 70% have a year.
// Only dates the form would accept: 29 February with a leap year or without a year
export function pickFakeBirthday(random: () => number = Math.random): Birthday | null {
  if (random() >= CHANCE_OF_BIRTHDAY) return null;

  const year =
    random() < CHANCE_OF_YEAR
      ? FIRST_YEAR + Math.floor(random() * (LAST_YEAR - FIRST_YEAR + 1))
      : null;
  const month = 1 + Math.floor(random() * 12);
  // Without a year, 29 February is possible: 2000 is a leap year
  const day = 1 + Math.floor(random() * daysInMonth(month, year ?? 2000));
  return { day, month, year };
}
