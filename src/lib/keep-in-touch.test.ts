import { describe, expect, it } from "vitest";

import {
  describeReachOut,
  dueAt,
  pickContactsToReachOut,
  type ContactToReachOut,
} from "./keep-in-touch";

const at = (iso: string) => new Date(iso);

function contact(fields: Partial<ContactToReachOut> & { name: string }): ContactToReachOut {
  return {
    id: 1,
    frequency: "week",
    lastNoteAt: null,
    since: at("2026-01-01T00:00:00Z"),
    ...fields,
  };
}

describe("dueAt", () => {
  it("a week is exactly 7 days", () => {
    expect(dueAt(at("2026-03-10T15:30:00Z"), "week")).toEqual(at("2026-03-17T15:30:00Z"));
  });

  it("a month is a calendar one and keeps the time of day", () => {
    expect(dueAt(at("2026-01-15T10:00:00Z"), "month")).toEqual(at("2026-02-15T10:00:00Z"));
  });

  it("a month after the 31st ends on the last day of a shorter month", () => {
    expect(dueAt(at("2026-01-31T10:00:00Z"), "month")).toEqual(at("2026-02-28T10:00:00Z"));
    expect(dueAt(at("2028-01-31T10:00:00Z"), "month")).toEqual(at("2028-02-29T10:00:00Z"));
    expect(dueAt(at("2026-03-31T10:00:00Z"), "month")).toEqual(at("2026-04-30T10:00:00Z"));
  });

  it("a quarter is three calendar months", () => {
    expect(dueAt(at("2026-11-30T10:00:00Z"), "quarter")).toEqual(at("2027-02-28T10:00:00Z"));
  });

  it("a year is a calendar one", () => {
    expect(dueAt(at("2026-04-03T10:00:00Z"), "year")).toEqual(at("2027-04-03T10:00:00Z"));
    expect(dueAt(at("2028-02-29T10:00:00Z"), "year")).toEqual(at("2029-02-28T10:00:00Z"));
  });
});

describe("pickContactsToReachOut", () => {
  const now = at("2026-06-01T12:00:00Z");
  const names = (contacts: ContactToReachOut[]) => contacts.map(({ name }) => name);

  it("is due only after the whole period has passed", () => {
    const picked = pickContactsToReachOut(
      [
        contact({ name: "Ровно неделя", lastNoteAt: at("2026-05-25T12:00:00Z") }),
        contact({ name: "Неделя и минута", lastNoteAt: at("2026-05-25T11:59:00Z") }),
      ],
      now,
    );
    expect(names(picked)).toEqual(["Неделя и минута"]);
  });

  it("counts from the latest note, or from the day the frequency was chosen without notes", () => {
    const picked = pickContactsToReachOut(
      [
        contact({
          name: "Заметка вчера",
          since: at("2025-01-01T00:00:00Z"),
          lastNoteAt: at("2026-05-31T12:00:00Z"),
        }),
        contact({ name: "Без заметок, задано 8 дней назад", since: at("2026-05-24T12:00:00Z") }),
        contact({ name: "Без заметок, задано 6 дней назад", since: at("2026-05-26T12:00:00Z") }),
      ],
      now,
    );
    expect(names(picked)).toEqual(["Без заметок, задано 8 дней назад"]);
  });

  it("puts the most overdue first", () => {
    // A: once a week, 14 days overdue. B: once a year, 60 days overdue
    const picked = pickContactsToReachOut(
      [
        contact({ name: "А", frequency: "week", lastNoteAt: at("2026-05-11T12:00:00Z") }),
        contact({ name: "Б", frequency: "year", lastNoteAt: at("2025-04-02T12:00:00Z") }),
      ],
      now,
    );
    expect(names(picked)).toEqual(["Б", "А"]);
  });

  it("orders contacts due at the same moment by name", () => {
    const since = at("2026-01-01T00:00:00Z");
    const picked = pickContactsToReachOut(
      [contact({ id: 2, name: "Яна", since }), contact({ id: 3, name: "Анна", since })],
      now,
    );
    expect(names(picked)).toEqual(["Анна", "Яна"]);
  });
});

describe("describeReachOut", () => {
  it("shows the frequency and the date of the latest note", () => {
    const row = contact({ name: "С заметками", frequency: "month" });
    row.lastNoteAt = at("2026-04-03T12:00:00Z");
    expect(describeReachOut(row)).toBe("Раз в месяц · последняя заметка 3 апреля 2026 г.");
  });

  it("without notes shows the day the frequency was chosen", () => {
    const row = contact({ name: "Без заметок", since: at("2026-03-10T12:00:00Z") });
    expect(describeReachOut(row)).toBe(
      "Раз в неделю · заметок нет, частота задана 10 марта 2026 г.",
    );
  });
});
