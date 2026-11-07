export const fakeGroupNames = ["Семья", "Друзья", "Знакомые", "Теннис", "Аналитики"];

const CHANCE_OF_GROUPS = 1 / 3;

// Which groups one fake contact gets: about two thirds get none, the rest one or two
export function pickFakeGroupNames(random: () => number = Math.random): string[] {
  if (random() >= CHANCE_OF_GROUPS) return [];

  const remaining = [...fakeGroupNames];
  const pickOne = () => remaining.splice(Math.floor(random() * remaining.length), 1)[0];
  return random() < 0.5 ? [pickOne()] : [pickOne(), pickOne()];
}
