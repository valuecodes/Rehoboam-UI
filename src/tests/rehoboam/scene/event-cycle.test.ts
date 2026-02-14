import type { WorldEvent } from "../../../features/rehoboam/engine/types";
import type { ComputedEventAngle } from "../../../features/rehoboam/layout/compute-angles";
import { TAU } from "../../../features/rehoboam/layout/polar";
import {
  getChronologicalCycleIds,
  getRandomizedQuadrantCycleIds,
} from "../../../features/rehoboam/scene/event-cycle";

const createEventAngle = (
  id: string,
  angleRad: number,
  timestampMs: number
): ComputedEventAngle => {
  const event: WorldEvent = {
    id,
    title: id,
    timestampMs,
    severity: "medium",
    category: "test",
  };

  return {
    event,
    eventIds: [id],
    angleRad,
    markerHeight: 0.02,
    clusterSize: 1,
    isCluster: false,
  };
};

describe("getChronologicalCycleIds", () => {
  it("returns ids sorted by event timestamp ascending", () => {
    const eventAngles = [
      createEventAngle("e-2024", 5.1, 1_704_989_600_000),
      createEventAngle("e-2010", 2.2, 1_272_844_800_000),
      createEventAngle("e-2000", 0.4, 952_646_400_000),
      createEventAngle("e-2022", 3.4, 1_645_056_000_000),
    ] satisfies readonly ComputedEventAngle[];
    const cycle = getChronologicalCycleIds(eventAngles);

    expect(cycle).toStrictEqual(["e-2000", "e-2010", "e-2022", "e-2024"]);
  });

  it("returns each event id exactly once", () => {
    const eventAngles = [
      createEventAngle("a", 0.2, 1_705_000_000_000),
      createEventAngle("b", 1.8, 1_706_000_000_000),
      createEventAngle("c", 3.4, 1_707_000_000_000),
      createEventAngle("d", 5.4, 1_708_000_000_000),
      createEventAngle("e", 0.6, 1_709_000_000_000),
      createEventAngle("f", 2.8, 1_710_000_000_000),
    ] satisfies readonly ComputedEventAngle[];

    const cycle = getChronologicalCycleIds(eventAngles);
    const expectedIds = eventAngles
      .map((eventAngle) => eventAngle.event.id)
      .sort();
    const receivedIds = [...cycle].sort();

    expect(cycle).toHaveLength(eventAngles.length);
    expect(receivedIds).toStrictEqual(expectedIds);
  });

  it("uses id ascending as a stable tie-breaker for equal timestamps", () => {
    const eventAngles = [
      createEventAngle("evt-c", 0.1, 1_700_000_000_000),
      createEventAngle("evt-a", 1.8, 1_700_000_000_000),
      createEventAngle("evt-b", 3.3, 1_700_000_000_000),
    ] satisfies readonly ComputedEventAngle[];

    const cycle = getChronologicalCycleIds(eventAngles);
    expect(cycle).toStrictEqual(["evt-a", "evt-b", "evt-c"]);
  });
});

const getQuadrantIndex = (angleRad: number): number => {
  const boundedAngle = Math.max(0, Math.min(TAU - Number.EPSILON, angleRad));

  return Math.trunc(boundedAngle / (TAU / 4));
};

describe("getRandomizedQuadrantCycleIds", () => {
  it("is deterministic for the same event set", () => {
    const eventAngles = [
      createEventAngle("q0-a", 0.1, 1_700_000_000_000),
      createEventAngle("q1-a", 1.9, 1_700_100_000_000),
      createEventAngle("q2-a", 3.2, 1_700_200_000_000),
      createEventAngle("q3-a", 5.1, 1_700_300_000_000),
      createEventAngle("q0-b", 0.8, 1_700_400_000_000),
      createEventAngle("q1-b", 2.4, 1_700_500_000_000),
      createEventAngle("q2-b", 4.0, 1_700_600_000_000),
      createEventAngle("q3-b", 5.8, 1_700_700_000_000),
    ] satisfies readonly ComputedEventAngle[];

    const first = getRandomizedQuadrantCycleIds(eventAngles);
    const second = getRandomizedQuadrantCycleIds(eventAngles);

    expect(first).toStrictEqual(second);
  });

  it("returns each event id exactly once", () => {
    const eventAngles = [
      createEventAngle("a", 0.2, 1_705_000_000_000),
      createEventAngle("b", 1.8, 1_706_000_000_000),
      createEventAngle("c", 3.4, 1_707_000_000_000),
      createEventAngle("d", 5.4, 1_708_000_000_000),
      createEventAngle("e", 0.6, 1_709_000_000_000),
      createEventAngle("f", 2.8, 1_710_000_000_000),
    ] satisfies readonly ComputedEventAngle[];

    const cycle = getRandomizedQuadrantCycleIds(eventAngles);
    const expectedIds = eventAngles
      .map((eventAngle) => eventAngle.event.id)
      .sort();
    const receivedIds = [...cycle].sort();

    expect(cycle).toHaveLength(eventAngles.length);
    expect(receivedIds).toStrictEqual(expectedIds);
  });

  it("covers all four quadrants within the first round when available", () => {
    const eventAngles = [
      createEventAngle("q0", 0.1, 1_700_000_000_000),
      createEventAngle("q1", 1.8, 1_701_000_000_000),
      createEventAngle("q2", 3.3, 1_702_000_000_000),
      createEventAngle("q3", 5.2, 1_703_000_000_000),
      createEventAngle("q0-extra", 0.7, 1_704_000_000_000),
      createEventAngle("q3-extra", 5.9, 1_705_000_000_000),
    ] satisfies readonly ComputedEventAngle[];

    const angleById = new Map(
      eventAngles.map((eventAngle) => {
        return [eventAngle.event.id, eventAngle.angleRad];
      })
    );
    const cycle = getRandomizedQuadrantCycleIds(eventAngles);
    const firstRoundQuadrants = new Set(
      cycle.slice(0, 4).map((eventId) => {
        const angleRad = angleById.get(eventId);

        expect(angleRad).not.toBeUndefined();

        return getQuadrantIndex(angleRad ?? 0);
      })
    );

    expect(firstRoundQuadrants).toStrictEqual(new Set([0, 1, 2, 3]));
  });
});
