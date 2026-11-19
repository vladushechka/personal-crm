import { describe, expect, it } from "vitest";

import { birthdayError } from "../src/lib/birthdays";

import { pickFakeBirthday } from "./fake-birthdays";

// The same "random" numbers on every run, so the test can't fail by chance
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

const today = { year: 2026, month: 11, day: 18 };

describe("pickFakeBirthday", () => {
  it("gives about a third of contacts a birthday, about 70% of them with a year", () => {
    const random = seededRandom(42);
    const picks = Array.from({ length: 3000 }, () => pickFakeBirthday(random));

    const withBirthday = picks.filter((birthday) => birthday !== null);
    expect(withBirthday.length).toBeGreaterThan(900);
    expect(withBirthday.length).toBeLessThan(1100);

    const withYear = withBirthday.filter((birthday) => birthday.year !== null);
    expect(withYear.length / withBirthday.length).toBeGreaterThan(0.6);
    expect(withYear.length / withBirthday.length).toBeLessThan(0.8);
  });

  it("every date is one the form would accept, years 1950 to 2005", () => {
    const random = seededRandom(7);
    for (let i = 0; i < 3000; i++) {
      const birthday = pickFakeBirthday(random);
      if (!birthday) continue;
      const { day, month, year } = birthday;
      expect(
        birthdayError(String(day), String(month), year === null ? "" : String(year), today),
      ).toBeNull();
      if (year !== null) {
        expect(year).toBeGreaterThanOrEqual(1950);
        expect(year).toBeLessThanOrEqual(2005);
      }
    }
  });

  it("spreads birthdays over all months and days", () => {
    const random = seededRandom(1);
    const picks = Array.from({ length: 3000 }, () => pickFakeBirthday(random)).filter(
      (birthday) => birthday !== null,
    );

    expect(new Set(picks.map(({ month }) => month)).size).toBe(12);
    expect(new Set(picks.map(({ day }) => day)).size).toBe(31);
  });
});
