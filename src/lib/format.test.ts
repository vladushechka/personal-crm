import { describe, expect, it } from "vitest";

import { formatDate, formatDateTime } from "./format";

// The site shows Moscow time to everyone, whatever the time zone of the server or the viewer
describe("dates are shown in Moscow time", () => {
  it("date and time of a note", () => {
    expect(formatDateTime(new Date("2026-11-07T22:30:00Z"))).toBe("8 ноября 2026 г. в 01:30");
  });

  it("a date just after midnight in Moscow", () => {
    expect(formatDate(new Date("2026-04-02T22:00:00Z"))).toBe("3 апреля 2026 г.");
  });
});
