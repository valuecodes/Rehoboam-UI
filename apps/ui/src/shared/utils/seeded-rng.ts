const UINT32_RANGE = 0x1_0000_0000;
const MULBERRY32_CONSTANT = 0x6d2b79f5;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export type SeedInput = number | string;

export type SeededRng = Readonly<{
  next: () => number;
  nextFloat: (min?: number, max?: number) => number;
  nextInt: (min: number, max: number) => number;
  getState: () => number;
  clone: () => SeededRng;
}>;

const hashStringToUint32 = (seed: string): number => {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
};

const normalizeSeed = (seed: SeedInput): number => {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return seed >>> 0;
  }

  return hashStringToUint32(`${seed}`);
};

const createFromState = (initialState: number): SeededRng => {
  let state = initialState >>> 0;

  const next = () => {
    state = (state + MULBERRY32_CONSTANT) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };

  const nextFloat = (min = 0, max = 1) => {
    if (!(max > min)) {
      throw new RangeError(
        `Expected max > min for nextFloat, received min=${min} max=${max}`
      );
    }

    return min + (max - min) * next();
  };

  const nextInt = (min: number, max: number) => {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new TypeError(
        `Expected integer bounds for nextInt, received min=${min} max=${max}`
      );
    }

    if (!(max > min)) {
      throw new RangeError(
        `Expected max > min for nextInt, received min=${min} max=${max}`
      );
    }

    return Math.floor(nextFloat(min, max));
  };

  const getState = () => state;

  const clone = () => createFromState(state);

  return {
    next,
    nextFloat,
    nextInt,
    getState,
    clone,
  };
};

export const createSeededRng = (seed: SeedInput): SeededRng => {
  return createFromState(normalizeSeed(seed));
};
