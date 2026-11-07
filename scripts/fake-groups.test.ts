import { describe, expect, it } from "vitest";

import { fakeGroupNames, pickFakeGroupNames } from "./fake-groups";

// The same "random" numbers on every run, so the test can't fail by chance
function seededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

describe("pickFakeGroupNames", () => {
  it("gives about a third of contacts a group", () => {
    const random = seededRandom(42);
    const picks = Array.from({ length: 3000 }, () => pickFakeGroupNames(random));

    const inGroups = picks.filter((names) => names.length > 0).length;
    expect(inGroups).toBeGreaterThan(900);
    expect(inGroups).toBeLessThan(1100);
  });

  it("gives one or two groups, never the same one twice, only from the list", () => {
    const random = seededRandom(7);
    for (let i = 0; i < 3000; i++) {
      const names = pickFakeGroupNames(random);
      expect(names.length).toBeLessThanOrEqual(2);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) expect(fakeGroupNames).toContain(name);
    }
  });

  it("uses all five groups", () => {
    const random = seededRandom(1);
    const used = new Set(Array.from({ length: 3000 }, () => pickFakeGroupNames(random)).flat());

    expect(used.size).toBe(5);
  });
});
