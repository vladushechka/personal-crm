const pluralRules = new Intl.PluralRules("ru-RU");

// pluralize(5, ["контакт", "контакта", "контактов"]) -> "5 контактов"
export function pluralize(count: number, [one, few, many]: [string, string, string]) {
  const rule = pluralRules.select(count);
  const word = rule === "one" ? one : rule === "few" ? few : many;
  return `${count} ${word}`;
}

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
});

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long" });

// formatDate(new Date("2026-04-03")) -> "3 апреля 2026 г."
export function formatDate(date: Date) {
  return dateFormat.format(date);
}
