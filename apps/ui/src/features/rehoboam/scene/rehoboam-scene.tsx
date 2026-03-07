import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { refreshEventsFromSourceWithStatus } from "../data/bootstrap";
import { createApiEventSource } from "../data/source";
import { DEFAULT_DPR_CAP, DEFAULT_THEME } from "../engine/defaults";
import { createInitialInteractionState } from "../engine/input";
import { createRehoboamEngine } from "../engine/rehoboam-engine";
import type {
  DivergenceCalloutTarget,
  InteractionState,
  RehoboamEngine,
  RehoboamRenderDiagnostics,
  RehoboamRenderSnapshot,
  WorldEvent,
} from "../engine/types";
import {
  computeAngles,
  DEFAULT_MAX_VISIBLE_EVENT_COUNT,
} from "../layout/compute-angles";
import type { ComputedEventAngle } from "../layout/compute-angles";
import { getLayoutNowMs } from "../layout/layout-time";
import { CalloutOverlay } from "../overlay/callout-overlay";
import type {
  CalloutOverlayTarget,
  InstrumentSize,
} from "../overlay/callout-overlay";
import { IntroCalloutOverlay } from "../overlay/intro-callout-overlay";
import { getChronologicalCycleIds } from "./event-cycle";
import type { SceneQualityTier } from "./quality";
import { resolveSceneQualityProfile } from "./quality";

import "./rehoboam-scene.css";

// Preserve the latest snapshot across remounts so bootstrap fallback stays warm
// without reintroducing client-side persistence.
let cachedEvents: readonly WorldEvent[] = [];

const INTRO_DEBUG_QUERY_KEY = "intro-debug";
const HUD_DEBUG_QUERY_KEY = "hud";
const HUD_PUBLISH_INTERVAL_MS = 240;
const CALLOUT_DEBUG_QUERY_KEYS = [
  "callout-debug",
  "callout-debug-half",
  "callout-debug-side",
] as const;

type OverlayDebugState = Readonly<{
  hasCalloutDebugQuery: boolean;
  isHudEnabled: boolean;
  isIntroDebugMode: boolean;
}>;

type HudNetworkStatus = "idle" | "loading" | "success" | "fallback";

export type RehoboamSceneProps = Readonly<{
  forceHudEnabled?: boolean;
}>;

const LazyDeveloperHud = lazy(async () => {
  const module = await import("../overlay/developer-hud");

  return {
    default: module.DeveloperHud,
  };
});

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
    isHudEnabled: isDebugFlagEnabled(searchParams.get(HUD_DEBUG_QUERY_KEY)),
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

  return (
    [...eventAngles].sort(compareEventAnglesByTimestamp)[0]?.event.id ?? null
  );
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

export const RehoboamScene = ({
  forceHudEnabled = false,
}: RehoboamSceneProps) => {
  const overlayDebugState = useMemo(() => {
    return readOverlayDebugState();
  }, []);
  const isHudEnabled = forceHudEnabled || overlayDebugState.isHudEnabled;
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
  const [networkStatus, setNetworkStatus] = useState<HudNetworkStatus>("idle");
  const [publishedHudDiagnostics, setPublishedHudDiagnostics] =
    useState<RehoboamRenderDiagnostics | null>(null);
  const activeClusterTargetRef = useRef<DivergenceCalloutTarget | null>(null);
  const clusterTargetsRef = useRef<readonly DivergenceCalloutTarget[]>([]);
  const autoCycleEventIdsRef = useRef<readonly string[]>([]);
  const activeEventIdRef = useRef<string | null>(null);
  const latestRenderDiagnosticsRef = useRef<RehoboamRenderDiagnostics | null>(
    null
  );
  const eventSource = useMemo(() => createApiEventSource("/api/events"), []);
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
  }, [activeClusterTarget, activeEventAngle, instrumentSize]);
  const hudQualityTier: SceneQualityTier = qualityProfile.tier;
  const activeEventAnnouncement = useMemo(() => {
    if (activeEventAngle === null) {
      return "";
    }

    const event = activeEventAngle.event;
    const location = event.location?.label ?? "Unknown location";

    return `Now showing: ${event.title}, ${location}, ${event.severity} severity`;
  }, [activeEventAngle]);

  useEffect(() => {
    autoCycleEventIdsRef.current = autoCycleEventIds;
  }, [autoCycleEventIds]);

  useEffect(() => {
    activeEventIdRef.current = activeEventId;
  }, [activeEventId]);

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

    const cycleEventIds = autoCycleEventIdsRef.current;
    const currentActiveEventId = activeEventIdRef.current;

    if (cycleEventIds.length === 0) {
      setAutoEventId(null);

      return;
    }

    if (currentActiveEventId === null) {
      setAutoEventId(cycleEventIds[0]);

      return;
    }

    const currentIndex = cycleEventIds.indexOf(currentActiveEventId);

    if (currentIndex < 0) {
      setAutoEventId(cycleEventIds[0]);

      return;
    }

    const nextIndex = (currentIndex + 1) % cycleEventIds.length;
    setAutoEventId(cycleEventIds[nextIndex]);
  }, []);

  const handleRenderSnapshot = useCallback(
    (snapshot: RehoboamRenderSnapshot) => {
      clusterTargetsRef.current = snapshot.divergenceCalloutTargets;
      latestRenderDiagnosticsRef.current = snapshot.diagnostics ?? null;

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
    },
    []
  );

  useEffect(() => {
    if (!isHudEnabled) {
      return;
    }

    const publishDiagnostics = () => {
      setPublishedHudDiagnostics(latestRenderDiagnosticsRef.current);
    };

    publishDiagnostics();
    const intervalHandle = window.setInterval(
      publishDiagnostics,
      HUD_PUBLISH_INTERVAL_MS
    );

    return () => {
      window.clearInterval(intervalHandle);
    };
  }, [isHudEnabled]);

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
    !isHudEnabled &&
    !overlayDebugState.hasCalloutDebugQuery &&
    (overlayDebugState.isIntroDebugMode || !isIntroComplete);

  useEffect(() => {
    const abortController = new AbortController();
    const shouldAbort = (): boolean => {
      return abortController.signal.aborted;
    };

    const bootEvents = async () => {
      setNetworkStatus("loading");
      const refreshedResult = await refreshEventsFromSourceWithStatus({
        existingEvents: cachedEvents,
        source: eventSource,
      });

      if (shouldAbort()) {
        return;
      }

      cachedEvents = refreshedResult.events;
      setNetworkStatus(refreshedResult.status);
      setEvents(refreshedResult.events);
    };

    void bootEvents();

    return () => {
      abortController.abort();
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
      diagnosticsEnabled: isHudEnabled,
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
  }, [handleRenderSnapshot, isHudEnabled]);

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
    <div className="rehoboam-scene">
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
        {isHudEnabled ? (
          <Suspense fallback={null}>
            <LazyDeveloperHud
              diagnostics={publishedHudDiagnostics}
              eventCount={events.length}
              instrumentSize={instrumentSize}
              networkStatus={networkStatus}
              qualityTier={hudQualityTier}
            />
          </Suspense>
        ) : null}
        <p className="rehoboam-scene__debug-label">
          Events are AI-parsed and may contain inaccuracies
        </p>
        <div
          aria-atomic="true"
          aria-live="polite"
          className="visually-hidden"
          role="status"
        >
          {activeEventAnnouncement}
        </div>
      </section>
    </div>
  );
};
