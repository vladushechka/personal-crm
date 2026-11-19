import { describe, expect, it } from "vitest";

import { moscowToday } from "./birthdays";
import { contactInputSchema } from "./contact-schema";

const form = {
  name: "Анна",
  about: "",
  howWeMet: "",
  phone: "",
  email: "",
  birthdayDay: "",
  birthdayMonth: "",
  birthdayYear: "",
};

describe("contactInputSchema: birthday", () => {
  it("no birthday when the three fields are empty", () => {
    const parsed = contactInputSchema.parse(form);
    expect(parsed).toMatchObject({ birthdayDay: null, birthdayMonth: null, birthdayYear: null });
  });

  it("a date with a year becomes numbers", () => {
    const parsed = contactInputSchema.parse({
      ...form,
      birthdayDay: "24",
      birthdayMonth: "11",
      birthdayYear: " 1990 ",
    });
    expect(parsed).toMatchObject({ birthdayDay: 24, birthdayMonth: 11, birthdayYear: 1990 });
  });

  it("a date without a year", () => {
    const parsed = contactInputSchema.parse({ ...form, birthdayDay: "29", birthdayMonth: "2" });
    expect(parsed).toMatchObject({ birthdayDay: 29, birthdayMonth: 2, birthdayYear: null });
  });

  it("an invalid date is one error under the key birthday", () => {
    const result = contactInputSchema.safeParse({ ...form, birthdayDay: "24" });
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ path: ["birthday"], message: "Укажите день и месяц" }),
    ]);
  });

  it("a request around the form: day 40 or month 13", () => {
    expect(
      contactInputSchema.safeParse({ ...form, birthdayDay: "40", birthdayMonth: "11" }).success,
    ).toBe(false);
    expect(
      contactInputSchema.safeParse({ ...form, birthdayDay: "24", birthdayMonth: "13" }).success,
    ).toBe(false);
  });

  it("a year after the current Moscow year is in the future", () => {
    const nextYear = String(moscowToday(new Date()).year + 1);
    const result = contactInputSchema.safeParse({
      ...form,
      birthdayDay: "1",
      birthdayMonth: "1",
      birthdayYear: nextYear,
    });
    expect(result.error?.issues[0]?.message).toBe("Дата рождения в будущем");
  });

  it("shows the birthday error together with errors of other fields", () => {
    const result = contactInputSchema.safeParse({ ...form, name: "", birthdayMonth: "11" });
    expect(result.error?.issues.map(({ path }) => path[0])).toEqual(["name", "birthday"]);
  });
});
