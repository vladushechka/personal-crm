const pluralRules = new Intl.PluralRules("ru-RU");

// pluralize(5, ["контакт", "контакта", "контактов"]) -> "5 контактов"
export function pluralize(count: number, [one, few, many]: [string, string, string]) {
  const rule = pluralRules.select(count);
  const word = rule === "one" ? one : rule === "few" ? few : many;
  return `${count} ${word}`;
}

// Everyone sees Moscow time, whatever the time zone of the server (UTC) or of the viewer
const TIME_ZONE = "Europe/Moscow";

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: TIME_ZONE,
});

export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date);
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: TIME_ZONE });

// formatDate(new Date("2026-04-03")) -> "3 апреля 2026 г."
export function formatDate(date: Date) {
  return dateFormat.format(date);
}
