import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { refreshEventsFromSource } from "../data/bootstrap";
import { loadPersistedEvents } from "../data/persistence";
import { createMockEventSource } from "../data/source";
import { DEFAULT_DPR_CAP, DEFAULT_THEME } from "../engine/defaults";
import { createInitialInteractionState } from "../engine/input";
import { createRehoboamEngine } from "../engine/rehoboam-engine";
import type {
  DivergenceCalloutTarget,
  InteractionState,
  RehoboamEngine,
  RehoboamRenderSnapshot,
  WorldEvent,
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
import { IntroCalloutOverlay } from "../overlay/intro-callout-overlay";
import { getChronologicalCycleIds } from "./event-cycle";
import { resolveSceneQualityProfile } from "./quality";

import "./rehoboam-scene.css";

const LEADING_TIME_OFFSET_MS = 45 * 60 * 1000;
const INTRO_DEBUG_QUERY_KEY = "intro-debug";
const CALLOUT_DEBUG_QUERY_KEYS = [
  "callout-debug",
  "callout-debug-half",
  "callout-debug-side",
] as const;

type OverlayDebugState = Readonly<{
  hasCalloutDebugQuery: boolean;
  isIntroDebugMode: boolean;
}>;

const isDebugFlagEnabled = (value: string | null): boolean => {
  if (value === null) {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();

  if (normalizedValue.length === 0) {
    return true;
  }

  return ["1", "true", "on", "yes"].includes(normalizedValue);
};

const readOverlayDebugState = (): OverlayDebugState => {
  const searchParams = new URLSearchParams(window.location.search);
  const hasCalloutDebugQuery = CALLOUT_DEBUG_QUERY_KEYS.some((queryKey) => {
    return searchParams.has(queryKey);
  });
  const isIntroDebugMode =
    !hasCalloutDebugQuery &&
    isDebugFlagEnabled(searchParams.get(INTRO_DEBUG_QUERY_KEY));

  return {
    hasCalloutDebugQuery,
    isIntroDebugMode,
  };
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

const compareEventAnglesByTimestamp = (
  left: ComputedEventAngle,
  right: ComputedEventAngle
): number => {
  if (left.event.timestampMs !== right.event.timestampMs) {
    return left.event.timestampMs - right.event.timestampMs;
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

const resolveActiveEventAngle = (
  eventAngles: readonly ComputedEventAngle[],
  activeEventId: string | null
): ComputedEventAngle | null => {
  if (eventAngles.length === 0) {
    return null;
  }

  if (activeEventId !== null) {
    const matchedEventAngle = eventAngles.find((eventAngle) => {
      return eventAngle.eventIds.includes(activeEventId);
    });

    if (matchedEventAngle !== undefined) {
      return matchedEventAngle;
    }
  }

  return [...eventAngles].sort(compareEventAnglesByTimestamp)[0] ?? null;
};

const resolveActiveEventId = (
  eventAngles: readonly ComputedEventAngle[],
  autoEventId: string | null
): string | null => {
  if (autoEventId !== null) {
    const hasAutoEvent = eventAngles.some((eventAngle) => {
      return eventAngle.eventIds.includes(autoEventId);
    });

    if (hasAutoEvent) {
      return autoEventId;
    }
  }

  return [...eventAngles].sort(compareEventAnglesByTimestamp)[0]?.event.id ?? null;
};

const pickRandomClusterTarget = (
  clusterTargets: readonly DivergenceCalloutTarget[],
  previousClusterTargetId: string | null
): DivergenceCalloutTarget | null => {
  if (clusterTargets.length === 0) {
    return null;
  }

  const candidateTargets =
    previousClusterTargetId === null || clusterTargets.length <= 1
      ? clusterTargets
      : clusterTargets.filter((target) => {
          return target.id !== previousClusterTargetId;
        });
  const randomIndex = Math.floor(Math.random() * candidateTargets.length);

  return candidateTargets[randomIndex] ?? clusterTargets[0];
};

export const RehoboamScene = () => {
  const overlayDebugState = useMemo(() => {
    return readOverlayDebugState();
  }, []);
  const instrumentRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<RehoboamEngine | null>(null);
  const [instrumentSize, setInstrumentSize] = useState<InstrumentSize>({
    width: 0,
    height: 0,
  });
  const [events, setEvents] = useState<readonly WorldEvent[]>([]);
  const [isIntroComplete, setIsIntroComplete] = useState(() => {
    return overlayDebugState.hasCalloutDebugQuery;
  });
  const [autoEventId, setAutoEventId] = useState<string | null>(null);
  const [activeClusterTarget, setActiveClusterTarget] =
    useState<DivergenceCalloutTarget | null>(null);
  const [calloutCycleToken, setCalloutCycleToken] = useState(0);
  const activeClusterTargetRef = useRef<DivergenceCalloutTarget | null>(null);
  const clusterTargetsRef = useRef<readonly DivergenceCalloutTarget[]>([]);
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
    return getChronologicalCycleIds(eventAngles);
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
      angleRad: activeClusterTarget?.angleRad ?? activeEventAngle.angleRad,
      anchorRadius: getMarkerAnchorRadius(instrumentSize),
    };
  }, [activeClusterTarget, activeEventAngle, instrumentSize.height, instrumentSize.width]);

  const advanceCalloutClusterTarget = useCallback(() => {
    setCalloutCycleToken((currentToken) => {
      return currentToken + 1;
    });

    const nextClusterTarget = pickRandomClusterTarget(
      clusterTargetsRef.current,
      activeClusterTargetRef.current?.id ?? null
    );
    activeClusterTargetRef.current = nextClusterTarget;
    setActiveClusterTarget(nextClusterTarget);

    if (autoCycleEventIds.length === 0) {
      setAutoEventId(null);

      return;
    }

    if (activeEventId === null) {
      setAutoEventId(autoCycleEventIds[0]);

      return;
    }

    const currentIndex = autoCycleEventIds.indexOf(activeEventId);

    if (currentIndex < 0) {
      setAutoEventId(autoCycleEventIds[0]);

      return;
    }

    const nextIndex = (currentIndex + 1) % autoCycleEventIds.length;
    setAutoEventId(autoCycleEventIds[nextIndex]);
  }, [activeEventId, autoCycleEventIds]);

  const handleRenderSnapshot = useCallback((snapshot: RehoboamRenderSnapshot) => {
    clusterTargetsRef.current = snapshot.divergenceCalloutTargets;

    if (
      activeClusterTargetRef.current === null &&
      snapshot.divergenceCalloutTargets.length > 0
    ) {
      const nextClusterTarget = pickRandomClusterTarget(
        snapshot.divergenceCalloutTargets,
        null
      );
      activeClusterTargetRef.current = nextClusterTarget;
      setActiveClusterTarget(nextClusterTarget);
    }
  }, []);

  useEffect(() => {
    if (autoCycleEventIds.length === 0) {
      setAutoEventId(null);

      return;
    }

    setAutoEventId((previousAutoEventId) => {
      if (
        previousAutoEventId === null ||
        !autoCycleEventIds.includes(previousAutoEventId)
      ) {
        return autoCycleEventIds[0];
      }

      return previousAutoEventId;
    });
  }, [autoCycleEventIds]);

  const handleCalloutCycleComplete = useCallback(() => {
    advanceCalloutClusterTarget();
  }, [advanceCalloutClusterTarget]);
  const shouldRenderIntro =
    !overlayDebugState.hasCalloutDebugQuery &&
    (overlayDebugState.isIntroDebugMode || !isIntroComplete);

  useEffect(() => {
    let isCancelled = false;

    const bootEvents = async () => {
      const cachedEvents = await loadPersistedEvents();

      if (!isCancelled && cachedEvents.length > 0) {
        setEvents(cachedEvents);
      }

      const refreshedEvents = await refreshEventsFromSource({
        existingEvents: cachedEvents,
        source: eventSource,
      });

      if (!isCancelled) {
        setEvents(refreshedEvents);
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
      onRenderSnapshot: handleRenderSnapshot,
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
  }, [handleRenderSnapshot]);

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
        {shouldRenderIntro ? (
          <IntroCalloutOverlay
            debugMode={overlayDebugState.isIntroDebugMode}
            instrumentSize={instrumentSize}
            onComplete={() => {
              setIsIntroComplete(true);
            }}
          />
        ) : (
          <CalloutOverlay
            cycleToken={calloutCycleToken}
            instrumentSize={instrumentSize}
            target={activeCalloutTarget}
            onCycleComplete={handleCalloutCycleComplete}
          />
        )}
      </section>
    </main>
  );
};
