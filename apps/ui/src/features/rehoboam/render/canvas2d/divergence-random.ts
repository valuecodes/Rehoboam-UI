import type { SeededRng } from "~/shared/utils/seeded-rng";

const randomFromRange = (
  random: SeededRng,
  range: readonly [number, number]
): number => random.nextFloat(range[0], range[1]);

const randomIntFromRange = (
  random: SeededRng,
  range: readonly [number, number]
): number => random.nextInt(range[0], range[1]);

export { randomFromRange, randomIntFromRange };
