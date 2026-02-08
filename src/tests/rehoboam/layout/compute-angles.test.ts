import type { WorldEvent } from "../../../features/rehoboam/engine/types";
import {
  computeAngles,
  getClusteringThresholdRad,
  getMarkerHeightForSeverity,
  mapTimestampToTimeWindowAngle,
  SEVERITY_MARKER_HEIGHT,
} from "../../../features/rehoboam/layout/compute-angles";
import { TAU } from "../../../features/rehoboam/layout/polar";

const createEvent = (overrides: Partial<WorldEvent>): WorldEvent => {
  return {
    id: "event-default",
    title: "Default event",
    timestampMs: 1_770_500_000_000,
    severity: "low",
    category: "general",
    ...overrides,
  };
};

describe("mapTimestampToTimeWindowAngle", () => {
  it("maps rolling window boundaries deterministically", () => {
    const nowMs = 1_770_600_000_000;
    const windowMs = 24 * 60 * 60 * 1000;
    const startMs = nowMs - windowMs;

    expect(
      mapTimestampToTimeWindowAngle(startMs - 1, { nowMs, windowMs })
    ).toBeCloseTo(0);
    expect(
      mapTimestampToTimeWindowAngle(startMs, { nowMs, windowMs })
    ).toBeCloseTo(0);

    const endAngle = mapTimestampToTimeWindowAngle(nowMs, { nowMs, windowMs });
    expect(endAngle).toBeGreaterThan(TAU * 0.999999);
    expect(endAngle).toBeLessThan(TAU);
  });
});

describe("getMarkerHeightForSeverity", () => {
  it("returns spec-aligned marker heights", () => {
    expect(getMarkerHeightForSeverity("low")).toBe(SEVERITY_MARKER_HEIGHT.low);
    expect(getMarkerHeightForSeverity("medium")).toBe(
      SEVERITY_MARKER_HEIGHT.medium
    );
    expect(getMarkerHeightForSeverity("high")).toBe(
      SEVERITY_MARKER_HEIGHT.high
    );
    expect(getMarkerHeightForSeverity("critical")).toBe(
      SEVERITY_MARKER_HEIGHT.critical
    );
  });
});

describe("computeAngles", () => {
  it("keeps stable ordering and deterministic output for the same input set", () => {
    const nowMs = 1_770_600_000_000;
    const events = [
      createEvent({
        id: "event-b",
        title: "B",
        timestampMs: nowMs - 8_000,
        severity: "high",
      }),
      createEvent({
        id: "event-a",
        title: "A",
        timestampMs: nowMs - 8_000,
        severity: "medium",
      }),
      createEvent({
        id: "event-c",
        title: "C",
        timestampMs: nowMs - 4_000,
        severity: "critical",
      }),
    ] satisfies readonly WorldEvent[];

    const first = computeAngles(events, {
      nowMs,
      maxVisibleCount: 48,
    });
    const second = computeAngles([events[2], events[0], events[1]], {
      nowMs,
      maxVisibleCount: 48,
    });

    expect(first).toStrictEqual(second);
    expect(first.map((item) => item.event.id)).toStrictEqual([
      "event-a",
      "event-b",
      "event-c",
    ]);
    expect(first.every((item) => !item.isCluster)).toBe(true);
  });

  it("clusters markers when event count exceeds max visible count", () => {
    const nowMs = 1_770_600_000_000;
    const maxVisibleCount = 3;
    const clusteredInput = Array.from({ length: 12 }, (_, index) => {
      return createEvent({
        id: `event-${index}`,
        title: `Event ${index}`,
        timestampMs: nowMs - 5_000 - index * 200,
        severity: index % 2 === 0 ? "medium" : "high",
        category: "system",
      });
    });

    const clustered = computeAngles(clusteredInput, {
      nowMs,
      maxVisibleCount,
    });

    expect(getClusteringThresholdRad(maxVisibleCount)).toBeCloseTo(TAU / 3);
    expect(clustered.length).toBeLessThanOrEqual(maxVisibleCount);
    expect(clustered.some((item) => item.isCluster)).toBe(true);
    expect(clustered.reduce((sum, item) => sum + item.clusterSize, 0)).toBe(
      clusteredInput.length
    );
  });
});
