import { describe, expect, it } from "vitest";

import {
  birthdayError,
  describeBirthday,
  formatBirthday,
  moscowToday,
  nextBirthday,
  pickUpcomingBirthdays,
  type CalendarDate,
  type ContactWithBirthday,
} from "./birthdays";

const day = (year: number, month: number, dayOfMonth: number): CalendarDate => ({
  year,
  month,
  day: dayOfMonth,
});

let nextId = 1;
function contact(name: string, month: number, dayOfMonth: number, year: number | null = null) {
  return {
    id: nextId++,
    name,
    birthday: { day: dayOfMonth, month, year },
  } satisfies ContactWithBirthday;
}

const names = (contacts: ContactWithBirthday[]) => contacts.map(({ name }) => name);

describe("moscowToday", () => {
  it("is the date in Moscow, not in UTC", () => {
    // 00:30 on 19 November in Moscow is still 18 November in UTC
    expect(moscowToday(new Date("2026-11-18T21:30:00Z"))).toEqual(day(2026, 11, 19));
    expect(moscowToday(new Date("2026-11-18T20:30:00Z"))).toEqual(day(2026, 11, 18));
  });

  it("new year comes at midnight in Moscow", () => {
    expect(moscowToday(new Date("2026-12-31T21:00:00Z"))).toEqual(day(2027, 1, 1));
  });
});

describe("nextBirthday", () => {
  it("today is 0 days away", () => {
    expect(nextBirthday({ day: 18, month: 11 }, day(2026, 11, 18))).toEqual({
      date: day(2026, 11, 18),
      inDays: 0,
    });
  });

  it("a birthday that has passed this year is next year", () => {
    expect(nextBirthday({ day: 17, month: 11 }, day(2026, 11, 18))).toEqual({
      date: day(2027, 11, 17),
      inDays: 364,
    });
  });

  it("across the new year", () => {
    expect(nextBirthday({ day: 2, month: 1 }, day(2026, 12, 29))).toEqual({
      date: day(2027, 1, 2),
      inDays: 4,
    });
  });

  it("29 February is 28 February in a non-leap year", () => {
    expect(nextBirthday({ day: 29, month: 2 }, day(2027, 2, 25))).toEqual({
      date: day(2027, 2, 28),
      inDays: 3,
    });
  });

  it("29 February in a leap year", () => {
    expect(nextBirthday({ day: 29, month: 2 }, day(2028, 2, 25))).toEqual({
      date: day(2028, 2, 29),
      inDays: 4,
    });
  });

  it("after 28 February in a non-leap year, 29 February of the next leap year", () => {
    expect(nextBirthday({ day: 29, month: 2 }, day(2027, 3, 1))).toEqual({
      date: day(2028, 2, 29),
      inDays: 365,
    });
  });
});

describe("pickUpcomingBirthdays", () => {
  // 12:00 on 18 November 2026 in Moscow
  const now = new Date("2026-11-18T09:00:00Z");

  it("the nearest birthday first", () => {
    const picked = pickUpcomingBirthdays(
      [contact("А", 11, 23), contact("Б", 11, 19), contact("В", 11, 18)],
      now,
    );
    expect(names(picked)).toEqual(["В", "Б", "А"]);
  });

  it("on the same day, by name", () => {
    const picked = pickUpcomingBirthdays(
      [contact("Яна", 11, 20), contact("Ёлкин", 11, 20), contact("Аня", 11, 20)],
      now,
    );
    expect(names(picked)).toEqual(["Аня", "Ёлкин", "Яна"]);
  });

  it("exactly a week away is in the block", () => {
    expect(names(pickUpcomingBirthdays([contact("Через неделю", 11, 25)], now))).toEqual([
      "Через неделю",
    ]);
  });

  it("8 days away and yesterday are not", () => {
    expect(
      pickUpcomingBirthdays([contact("Через 8", 11, 26), contact("Вчера", 11, 17)], now),
    ).toEqual([]);
  });

  it("across the new year", () => {
    const picked = pickUpcomingBirthdays(
      [contact("2 января", 1, 2), contact("6 января", 1, 6)],
      new Date("2026-12-29T09:00:00Z"),
    );
    expect(names(picked)).toEqual(["2 января"]);
  });

  it("today is counted in Moscow", () => {
    // 00:30 on 19 November in Moscow: the 19th is today, the 18th was yesterday
    const picked = pickUpcomingBirthdays(
      [contact("18 ноября", 11, 18), contact("19 ноября", 11, 19)],
      new Date("2026-11-18T21:30:00Z"),
    );
    expect(names(picked)).toEqual(["19 ноября"]);
  });

  it("nobody has a birthday soon", () => {
    expect(pickUpcomingBirthdays([contact("Весной", 4, 1)], now)).toEqual([]);
    expect(pickUpcomingBirthdays([], now)).toEqual([]);
  });

  it("29 February in a non-leap year and in a leap year", () => {
    const leapling = contact("29 февраля", 2, 29);
    expect(names(pickUpcomingBirthdays([leapling], new Date("2027-02-25T09:00:00Z")))).toEqual([
      "29 февраля",
    ]);
    // 2028: 29 February is 4 days away, still in the block; 2027-02-20 is 8 days before the 28th
    expect(names(pickUpcomingBirthdays([leapling], new Date("2028-02-25T09:00:00Z")))).toEqual([
      "29 февраля",
    ]);
    expect(pickUpcomingBirthdays([leapling], new Date("2027-02-20T09:00:00Z"))).toEqual([]);
  });
});

describe("describeBirthday", () => {
  const today = day(2026, 11, 18);

  it("today, the year is known", () => {
    expect(describeBirthday({ day: 18, month: 11, year: 1991 }, today)).toBe(
      "Сегодня, 18 ноября · исполняется 35",
    );
  });

  it("tomorrow, without a year", () => {
    expect(describeBirthday({ day: 19, month: 11, year: null }, today)).toBe("Завтра, 19 ноября");
  });

  it("in a few days", () => {
    expect(describeBirthday({ day: 24, month: 11, year: 1990 }, today)).toBe(
      "24 ноября, через 6 дней · исполнится 36",
    );
    expect(describeBirthday({ day: 20, month: 11, year: null }, today)).toBe(
      "20 ноября, через 2 дня",
    );
  });

  it("across the new year, the age is counted for the next year", () => {
    expect(describeBirthday({ day: 2, month: 1, year: 2000 }, day(2026, 12, 29))).toBe(
      "2 января, через 4 дня · исполнится 27",
    );
  });

  it("29 February in a non-leap year is shown as 28 February", () => {
    expect(describeBirthday({ day: 29, month: 2, year: null }, day(2027, 2, 25))).toBe(
      "28 февраля, через 3 дня",
    );
    expect(describeBirthday({ day: 29, month: 2, year: null }, day(2028, 2, 25))).toBe(
      "29 февраля, через 4 дня",
    );
  });
});

describe("formatBirthday", () => {
  it("a date with a year", () => {
    expect(formatBirthday({ day: 24, month: 11, year: 1990 })).toBe("24 ноября 1990 г.");
  });

  it("a date without a year", () => {
    expect(formatBirthday({ day: 24, month: 11, year: null })).toBe("24 ноября");
  });

  it("29 February stays 29 February in the card", () => {
    expect(formatBirthday({ day: 29, month: 2, year: null })).toBe("29 февраля");
  });

  it("every month in the genitive", () => {
    expect(
      Array.from({ length: 12 }, (_, i) => formatBirthday({ day: 1, month: i + 1, year: null })),
    ).toEqual([
      "1 января",
      "1 февраля",
      "1 марта",
      "1 апреля",
      "1 мая",
      "1 июня",
      "1 июля",
      "1 августа",
      "1 сентября",
      "1 октября",
      "1 ноября",
      "1 декабря",
    ]);
  });
});

describe("birthdayError", () => {
  const today = day(2026, 11, 18);
  const errorFor = (dayText: string, monthText: string, yearText: string) =>
    birthdayError(dayText, monthText, yearText, today);

  it("no birthday: all three are empty", () => {
    expect(errorFor("", "", "")).toBeNull();
  });

  it("a date with and without a year", () => {
    expect(errorFor("24", "11", "1990")).toBeNull();
    expect(errorFor("24", "11", "")).toBeNull();
  });

  it("only the day, only the month, or only the year", () => {
    expect(errorFor("24", "", "")).toBe("Укажите день и месяц");
    expect(errorFor("", "11", "")).toBe("Укажите день и месяц");
    expect(errorFor("", "", "1990")).toBe("Укажите день и месяц");
    expect(errorFor("24", "", "1990")).toBe("Укажите день и месяц");
  });

  it("a date that does not exist", () => {
    expect(errorFor("31", "4", "")).toBe("Такой даты нет");
    expect(errorFor("29", "2", "2023")).toBe("Такой даты нет");
    expect(errorFor("30", "2", "")).toBe("Такой даты нет");
  });

  it("29 February without a year or in a leap year", () => {
    expect(errorFor("29", "2", "")).toBeNull();
    expect(errorFor("29", "2", "2000")).toBeNull();
  });

  it("a date in the future", () => {
    expect(errorFor("1", "1", "2027")).toBe("Дата рождения в будущем");
    expect(errorFor("19", "11", "2026")).toBe("Дата рождения в будущем");
    expect(errorFor("18", "11", "2026")).toBeNull();
  });

  it("a year before 1900 or not a number", () => {
    expect(errorFor("24", "11", "1850")).toBe("Год — четыре цифры, от 1900");
    expect(errorFor("24", "11", "19ab")).toBe("Год — четыре цифры, от 1900");
    expect(errorFor("24", "11", "90")).toBe("Год — четыре цифры, от 1900");
    expect(errorFor("24", "11", "19900")).toBe("Год — четыре цифры, от 1900");
    expect(errorFor("24", "11", "1900")).toBeNull();
  });

  it("a request around the form: day 40, month 13 or not numbers", () => {
    expect(errorFor("40", "11", "")).toBe("Такой даты нет");
    expect(errorFor("24", "13", "")).toBe("Такой даты нет");
    expect(errorFor("0", "11", "")).toBe("Такой даты нет");
    expect(errorFor("24", "0", "")).toBe("Такой даты нет");
    expect(errorFor("2.5", "11", "")).toBe("Такой даты нет");
    expect(errorFor("24", "ноябрь", "")).toBe("Такой даты нет");
  });
});
