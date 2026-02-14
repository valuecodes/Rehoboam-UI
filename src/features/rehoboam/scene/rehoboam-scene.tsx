import { useEffect, useMemo, useRef, useState } from "react";

import { refreshEventsFromSource } from "../data/bootstrap";
import { loadPersistedEvents } from "../data/persistence";
import { createMockEventSource } from "../data/source";
import { DEFAULT_DPR_CAP, DEFAULT_THEME } from "../engine/defaults";
import { createInitialInteractionState } from "../engine/input";
import { createRehoboamEngine } from "../engine/rehoboam-engine";
import type {
  InteractionState,
  RehoboamEngine,
  WorldEvent,
  WorldEventSeverity,
} from "../engine/types";
import {
  computeAngles,
  DEFAULT_MAX_VISIBLE_EVENT_COUNT,
} from "../layout/compute-angles";
import type { ComputedEventAngle } from "../layout/compute-angles";
import { CalloutOverlay } from "../overlay/callout-overlay";
import type {
  CalloutOverlayTarget,
  InstrumentSize,
} from "../overlay/callout-overlay";
import { getRandomizedQuadrantCycleIds } from "./event-cycle";
import { resolveSceneQualityProfile } from "./quality";

import "./rehoboam-scene.css";

const LEADING_TIME_OFFSET_MS = 45 * 60 * 1000;
const AUTO_EVENT_CYCLE_MS = 9000;

const SEVERITY_RANK: Readonly<Record<WorldEventSeverity, number>> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const readDevicePixelRatio = (): number => {
  const value = window.devicePixelRatio;

  return Number.isFinite(value) && value > 0 ? value : 1;
};

const readHardwareConcurrency = (): number | null => {
  const value = navigator.hardwareConcurrency;

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.trunc(value);
};

const readDeviceMemoryGiB = (): number | null => {
  const capabilityNavigator = navigator as Navigator & {
    deviceMemory?: number;
  };
  const value = capabilityNavigator.deviceMemory;

  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return value;
};

const compareEventAnglesByPriority = (
  left: ComputedEventAngle,
  right: ComputedEventAngle
): number => {
  const severityDelta =
    SEVERITY_RANK[right.event.severity] - SEVERITY_RANK[left.event.severity];

  if (severityDelta !== 0) {
    return severityDelta;
  }

  if (left.event.timestampMs !== right.event.timestampMs) {
    return right.event.timestampMs - left.event.timestampMs;
  }

  return left.event.id.localeCompare(right.event.id);
};

const getLayoutNowMs = (events: readonly WorldEvent[]): number => {
  if (events.length === 0) {
    return 0;
  }

  const latestTimestampMs = events.reduce((latest, event) => {
    return Math.max(latest, event.timestampMs);
  }, 0);

  return latestTimestampMs + LEADING_TIME_OFFSET_MS;
};

const getMarkerAnchorRadius = (instrumentSize: InstrumentSize): number => {
  const outerRadius =
    Math.min(instrumentSize.width, instrumentSize.height) * 0.46;

  return outerRadius * 0.84;
};

const findEventAngleByEventId = (
  eventAngles: readonly ComputedEventAngle[],
  eventId: string
): ComputedEventAngle | null => {
  for (const eventAngle of eventAngles) {
    if (eventAngle.eventIds.includes(eventId)) {
      return eventAngle;
    }
  }

  return null;
};

const resolveActiveEventAngle = (
  eventAngles: readonly ComputedEventAngle[],
  activeEventId: string | null
): ComputedEventAngle | null => {
  if (eventAngles.length === 0) {
    return null;
  }

  if (activeEventId !== null) {
    const matched = findEventAngleByEventId(eventAngles, activeEventId);

    if (matched !== null) {
      return matched;
    }
  }

  return [...eventAngles].sort(compareEventAnglesByPriority)[0] ?? null;
};

const resolveActiveEventId = (
  eventAngles: readonly ComputedEventAngle[],
  autoEventId: string | null
): string | null => {
  if (autoEventId !== null) {
    if (findEventAngleByEventId(eventAngles, autoEventId) !== null) {
      return autoEventId;
    }
  }

  return (
    [...eventAngles].sort(compareEventAnglesByPriority)[0]?.event.id ?? null
  );
};

export const RehoboamScene = () => {
  const instrumentRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<RehoboamEngine | null>(null);
  const [instrumentSize, setInstrumentSize] = useState<InstrumentSize>({
    width: 0,
    height: 0,
  });
  const [events, setEvents] = useState<readonly WorldEvent[]>([]);
  const [autoEventId, setAutoEventId] = useState<string | null>(null);
  const eventSource = useMemo(() => createMockEventSource(), []);
  const qualityProfile = useMemo(() => {
    return resolveSceneQualityProfile({
      width: instrumentSize.width,
      height: instrumentSize.height,
      hardwareConcurrency: readHardwareConcurrency(),
      deviceMemoryGiB: readDeviceMemoryGiB(),
    });
  }, [instrumentSize.height, instrumentSize.width]);
  const eventAngles = useMemo(() => {
    return computeAngles(events, {
      nowMs: getLayoutNowMs(events),
      maxVisibleCount: DEFAULT_MAX_VISIBLE_EVENT_COUNT,
      distributionMode: "ordered",
    });
  }, [events]);
  const autoCycleEventIds = useMemo(() => {
    return getRandomizedQuadrantCycleIds(eventAngles);
  }, [eventAngles]);
  const activeEventId = useMemo(() => {
    return resolveActiveEventId(eventAngles, autoEventId);
  }, [autoEventId, eventAngles]);
  const activeEventAngle = useMemo(() => {
    return resolveActiveEventAngle(eventAngles, activeEventId);
  }, [activeEventId, eventAngles]);
  const engineInteraction = useMemo<InteractionState>(() => {
    return {
      pointer: null,
      isPointerDown: false,
      isDragging: false,
      hoverCandidateEventId: null,
      hoveredEventId: activeEventId,
      selectedEventId: null,
      hoverStartedAtMs: null,
    };
  }, [activeEventId]);
  const activeCalloutTarget = useMemo<CalloutOverlayTarget | null>(() => {
    if (
      activeEventAngle === null ||
      instrumentSize.width <= 0 ||
      instrumentSize.height <= 0
    ) {
      return null;
    }

    return {
      event: activeEventAngle.event,
      angleRad: activeEventAngle.angleRad,
      anchorRadius: getMarkerAnchorRadius(instrumentSize),
    };
  }, [activeEventAngle, instrumentSize.height, instrumentSize.width]);

  useEffect(() => {
    if (autoCycleEventIds.length === 0) {
      setAutoEventId(null);

      return;
    }

    if (autoEventId === null || !autoCycleEventIds.includes(autoEventId)) {
      setAutoEventId(autoCycleEventIds[0]);

      return;
    }

    const currentIndex = autoCycleEventIds.indexOf(autoEventId);
    const timeoutHandle = window.setTimeout(() => {
      const nextIndex = (currentIndex + 1) % autoCycleEventIds.length;
      setAutoEventId(autoCycleEventIds[nextIndex]);
    }, AUTO_EVENT_CYCLE_MS);

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [autoEventId, autoCycleEventIds]);

  useEffect(() => {
    let isCancelled = false;

    const bootEvents = async () => {
      const cachedEvents = await loadPersistedEvents();

      if (!isCancelled && cachedEvents.length > 0) {
        setEvents(cachedEvents);
      }

      const mergedEvents = await refreshEventsFromSource({
        existingEvents: cachedEvents,
        source: eventSource,
      });

      if (!isCancelled) {
        setEvents(mergedEvents);
      }
    };

    void bootEvents();

    return () => {
      isCancelled = true;
    };
  }, [eventSource]);

  useEffect(() => {
    const engine = engineRef.current;

    if (engine === null) {
      return;
    }

    engine.setTheme({
      ...DEFAULT_THEME,
      ringCount: qualityProfile.ringCount,
      divergenceSampleCount: qualityProfile.divergenceSampleCount,
    });
  }, [qualityProfile.divergenceSampleCount, qualityProfile.ringCount]);

  useEffect(() => {
    const instrument = instrumentRef.current;
    const canvas = canvasRef.current;

    if (instrument === null || canvas === null) {
      return;
    }

    const engine = createRehoboamEngine({
      canvas,
      dprCap: DEFAULT_DPR_CAP,
    });
    engineRef.current = engine;

    const resizeToBounds = (width: number, height: number) => {
      const nextWidth = Math.max(0, Math.round(width));
      const nextHeight = Math.max(0, Math.round(height));

      setInstrumentSize((previousSize) => {
        if (
          previousSize.width === nextWidth &&
          previousSize.height === nextHeight
        ) {
          return previousSize;
        }

        return {
          width: nextWidth,
          height: nextHeight,
        };
      });
      engine.resize({
        width: nextWidth,
        height: nextHeight,
        dpr: readDevicePixelRatio(),
      });
    };

    const initialBounds = instrument.getBoundingClientRect();
    resizeToBounds(initialBounds.width, initialBounds.height);

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      resizeToBounds(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(instrument);
    engine.setEvents([]);
    engine.setInteraction(createInitialInteractionState());
    engine.start();

    return () => {
      observer.disconnect();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const engine = engineRef.current;

    if (engine === null) {
      return;
    }

    engine.setInteraction(engineInteraction);
  }, [engineInteraction]);

  useEffect(() => {
    const engine = engineRef.current;

    if (engine === null) {
      return;
    }

    engine.setEvents(events);
  }, [events]);

  return (
    <main className="rehoboam-scene">
      <section
        aria-label="Rehoboam V2 scene container"
        className="rehoboam-scene__instrument"
        ref={instrumentRef}
      >
        <canvas
          aria-hidden
          className="rehoboam-scene__canvas"
          ref={canvasRef}
        />
        <CalloutOverlay
          instrumentSize={instrumentSize}
          target={activeCalloutTarget}
        />
      </section>
    </main>
  );
};
