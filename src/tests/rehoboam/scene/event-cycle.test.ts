import type { WorldEvent } from "../../../features/rehoboam/engine/types";
import type { ComputedEventAngle } from "../../../features/rehoboam/layout/compute-angles";
import { TAU } from "../../../features/rehoboam/layout/polar";
import { getRandomizedQuadrantCycleIds } from "../../../features/rehoboam/scene/event-cycle";

const createEventAngle = (id: string, angleRad: number): ComputedEventAngle => {
  const event: WorldEvent = {
    id,
    title: id,
    timestampMs: 1_770_500_000_000,
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

const getQuadrantIndex = (angleRad: number): number => {
  const boundedAngle = Math.max(0, Math.min(TAU - Number.EPSILON, angleRad));

  return Math.trunc(boundedAngle / (TAU / 4));
};

describe("getRandomizedQuadrantCycleIds", () => {
  it("is deterministic for the same event set", () => {
    const eventAngles = [
      createEventAngle("q0-a", 0.1),
      createEventAngle("q1-a", 1.9),
      createEventAngle("q2-a", 3.2),
      createEventAngle("q3-a", 5.1),
      createEventAngle("q0-b", 0.8),
      createEventAngle("q1-b", 2.4),
      createEventAngle("q2-b", 4.0),
      createEventAngle("q3-b", 5.8),
    ] satisfies readonly ComputedEventAngle[];

    const first = getRandomizedQuadrantCycleIds(eventAngles);
    const second = getRandomizedQuadrantCycleIds(eventAngles);

    expect(first).toStrictEqual(second);
  });

  it("returns each event id exactly once", () => {
    const eventAngles = [
      createEventAngle("a", 0.2),
      createEventAngle("b", 1.8),
      createEventAngle("c", 3.4),
      createEventAngle("d", 5.4),
      createEventAngle("e", 0.6),
      createEventAngle("f", 2.8),
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
      createEventAngle("q0", 0.1),
      createEventAngle("q1", 1.8),
      createEventAngle("q2", 3.3),
      createEventAngle("q3", 5.2),
      createEventAngle("q0-extra", 0.7),
      createEventAngle("q3-extra", 5.9),
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
