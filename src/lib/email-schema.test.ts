import { describe, expect, it } from "vitest";

import { emailSchema } from "./email-schema";

describe("emailSchema", () => {
  it("drops spaces at the ends and capital letters", () => {
    expect(emailSchema.parse("  Anna@Example.COM ")).toBe("anna@example.com");
  });

  it.each(["anna@example", "anna.example.com", "", "   ", "anna @example.com"])(
    "refuses %j with «Проверь адрес почты»",
    (value) => {
      const result = emailSchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Проверь адрес почты");
    },
  );
});
