import { describe, expect, it } from "vitest";

import { groupNameSchema } from "./group-schema";

function messageFor(name: string) {
  return groupNameSchema.safeParse(name).error?.issues[0]?.message;
}

describe("groupNameSchema", () => {
  it("rejects an empty name", () => {
    expect(messageFor("")).toBe("Укажите название");
  });

  it("rejects a name of spaces only", () => {
    expect(messageFor("   ")).toBe("Укажите название");
  });

  it("rejects a name longer than 50 characters", () => {
    expect(messageFor("я".repeat(51))).toBe("Слишком длинно: не больше 50 символов");
  });

  it("accepts a name of exactly 50 characters", () => {
    expect(groupNameSchema.safeParse("я".repeat(50)).success).toBe(true);
  });

  it("counts length after trimming the spaces around the name", () => {
    expect(groupNameSchema.parse(`  ${"я".repeat(50)}  `)).toBe("я".repeat(50));
  });

  it("trims the spaces around the name", () => {
    expect(groupNameSchema.parse("  Теннис  ")).toBe("Теннис");
  });
});
