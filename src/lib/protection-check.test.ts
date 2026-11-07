import { expect, it } from "vitest";

// Fails on purpose: shows that main protection keeps a red PR out. The PR gets closed unmerged
it("fails on purpose to check that main protection works", () => {
  expect(1 + 1).toBe(3);
});
