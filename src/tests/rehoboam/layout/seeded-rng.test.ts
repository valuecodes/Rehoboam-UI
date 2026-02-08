import { createSeededRng } from "../../../shared/utils/seeded-rng";

describe("createSeededRng", () => {
  it("produces identical sequences for the same seed", () => {
    const left = createSeededRng("rehoboam-seed");
    const right = createSeededRng("rehoboam-seed");

    const leftSequence = Array.from({ length: 12 }, () => left.next());
    const rightSequence = Array.from({ length: 12 }, () => right.next());

    expect(leftSequence).toStrictEqual(rightSequence);
  });

  it("produces different sequences for different seeds", () => {
    const left = createSeededRng("rehoboam-seed-a");
    const right = createSeededRng("rehoboam-seed-b");

    const leftSequence = Array.from({ length: 8 }, () => left.next());
    const rightSequence = Array.from({ length: 8 }, () => right.next());

    expect(leftSequence).not.toStrictEqual(rightSequence);
  });

  it("supports cloning from the current generator state", () => {
    const source = createSeededRng(42);

    source.next();
    source.next();

    const cloned = source.clone();

    expect(source.next()).toBe(cloned.next());
    expect(source.next()).toBe(cloned.next());
    expect(source.getState()).toBe(cloned.getState());
  });

  it("returns bounded deterministic integers", () => {
    const generator = createSeededRng(71);
    const values = Array.from({ length: 64 }, () => generator.nextInt(3, 9));

    expect(values.every((value) => value >= 3 && value < 9)).toBe(true);

    const replay = createSeededRng(71);
    const replayValues = Array.from({ length: 64 }, () => replay.nextInt(3, 9));

    expect(values).toStrictEqual(replayValues);
  });
});
