import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { refreshEventsFromSourceWithStatus } from "~/features/rehoboam/data/bootstrap";
import { createApiEventSource } from "~/features/rehoboam/data/source";
import { DEFAULT_DPR_CAP } from "~/features/rehoboam/engine/defaults";
import { createInitialInteractionState } from "~/features/rehoboam/engine/input";
import { createRehoboamEngine } from "~/features/rehoboam/engine/rehoboam-engine";
import { SEVERITY_INTENSITY } from "~/features/rehoboam/engine/severity";
import type {
  DivergenceCalloutTarget,
  InteractionState,
  RehoboamEngine,
  RehoboamRenderDiagnostics,
  RehoboamRenderSnapshot,
  WorldEvent,
} from "~/features/rehoboam/engine/types";
import {
  computeAngles,
  DEFAULT_MAX_VISIBLE_EVENT_COUNT,
} from "~/features/rehoboam/layout/compute-angles";
import { getLayoutNowMs } from "~/features/rehoboam/layout/layout-time";
import type {
  CalloutOverlayTarget,
  InstrumentSize,
} from "~/features/rehoboam/overlay/callout-geometry";
import { CalloutOverlay } from "~/features/rehoboam/overlay/callout-overlay";
import { IntroCalloutOverlay } from "~/features/rehoboam/overlay/intro-callout-overlay";

import {
  getMarkerAnchorRadius,
  getNextAutoEventId,
  pickRandomClusterTarget,
  resolveActiveEventAngle,
  resolveActiveEventId,
  resolveAutoEventId,
} from "./active-event";
import {
  readDeviceMemoryGiB,
  readDevicePixelRatio,
  readHardwareConcurrency,
} from "./device-capabilities";
import { getChronologicalCycleIds } from "./event-cycle";
import { readOverlayDebugState } from "./overlay-debug-state";
import type { SceneQualityTier } from "./quality";
import { resolveSceneQualityProfile } from "./quality";
import { useSeverityIntensityTransition } from "./use-severity-intensity-transition";

import "./rehoboam-scene.css";

// Preserve the latest snapshot across remounts so bootstrap fallback stays warm
// without reintroducing client-side persistence.
let cachedEvents: readonly WorldEvent[] = [];

const HUD_PUBLISH_INTERVAL_MS = 240;

type HudNetworkStatus = "idle" | "loading" | "success" | "fallback";

type RehoboamSceneProps = Readonly<{
  forceHudEnabled?: boolean;
}>;

const LazyDeveloperHud = lazy(async () => {
  const module = await import("~/features/rehoboam/overlay/developer-hud");

  return {
    default: module.DeveloperHud,
  };
});

const RehoboamScene = ({ forceHudEnabled = false }: RehoboamSceneProps) => {
  const overlayDebugState = useMemo(() => readOverlayDebugState(), []);
  const isHudEnabled = forceHudEnabled || overlayDebugState.isHudEnabled;
  const instrumentRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<RehoboamEngine | null>(null);
  const [instrumentSize, setInstrumentSize] = useState<InstrumentSize>({
    width: 0,
    height: 0,
  });
  const [events, setEvents] = useState<readonly WorldEvent[]>([]);
  const [isIntroComplete, setIsIntroComplete] = useState(
    () => overlayDebugState.hasCalloutDebugQuery
  );
  const [autoEventId, setAutoEventId] = useState<string | null>(null);
  const [activeClusterTarget, setActiveClusterTarget] =
    useState<DivergenceCalloutTarget | null>(null);
  const [calloutCycleToken, setCalloutCycleToken] = useState(0);
  const [networkStatus, setNetworkStatus] = useState<HudNetworkStatus>("idle");
  const [divergenceIntensity, setDivergenceIntensity] = useState(50);
  const [publishedHudDiagnostics, setPublishedHudDiagnostics] =
    useState<RehoboamRenderDiagnostics | null>(null);
  const [publishedSeverityIntensity, setPublishedSeverityIntensity] =
    useState(1);
  const activeClusterTargetRef = useRef<DivergenceCalloutTarget | null>(null);
  const clusterTargetsRef = useRef<readonly DivergenceCalloutTarget[]>([]);
  const autoCycleEventIdsRef = useRef<readonly string[]>([]);
  const activeEventIdRef = useRef<string | null>(null);
  const latestRenderDiagnosticsRef = useRef<RehoboamRenderDiagnostics | null>(
    null
  );
  const eventSource = useMemo(() => createApiEventSource("/api/events"), []);
  const qualityProfile = useMemo(
    () =>
      resolveSceneQualityProfile({
        width: instrumentSize.width,
        height: instrumentSize.height,
        hardwareConcurrency: readHardwareConcurrency(),
        deviceMemoryGiB: readDeviceMemoryGiB(),
      }),
    [instrumentSize.height, instrumentSize.width]
  );
  const eventAngles = useMemo(
    () =>
      computeAngles(events, {
        nowMs: getLayoutNowMs(events),
        maxVisibleCount: DEFAULT_MAX_VISIBLE_EVENT_COUNT,
        distributionMode: "ordered",
      }),
    [events]
  );
  const autoCycleEventIds = useMemo(
    () => getChronologicalCycleIds(eventAngles),
    [eventAngles]
  );
  const [previousAutoCycleEventIds, setPreviousAutoCycleEventIds] =
    useState(autoCycleEventIds);

  // Re-anchor the auto-cycled event whenever the cycle itself changes.
  if (previousAutoCycleEventIds !== autoCycleEventIds) {
    setPreviousAutoCycleEventIds(autoCycleEventIds);
    setAutoEventId(resolveAutoEventId(autoCycleEventIds, autoEventId));
  }

  const activeEventId = useMemo(
    () => resolveActiveEventId(eventAngles, autoEventId),
    [autoEventId, eventAngles]
  );
  const activeEventAngle = useMemo(
    () => resolveActiveEventAngle(eventAngles, activeEventId),
    [activeEventId, eventAngles]
  );
  const engineInteraction = useMemo<InteractionState>(
    () => ({
      pointer: null,
      isPointerDown: false,
      isDragging: false,
      hoverCandidateEventId: null,
      hoveredEventId: activeEventId,
      selectedEventId: null,
      hoverStartedAtMs: null,
    }),
    [activeEventId]
  );
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
    setCalloutCycleToken((currentToken) => currentToken + 1);

    const nextClusterTarget = pickRandomClusterTarget(
      clusterTargetsRef.current,
      activeClusterTargetRef.current?.id ?? null
    );
    activeClusterTargetRef.current = nextClusterTarget;
    setActiveClusterTarget(nextClusterTarget);

    setAutoEventId(
      getNextAutoEventId(autoCycleEventIdsRef.current, activeEventIdRef.current)
    );
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

  const handleCalloutCycleComplete = useCallback(() => {
    advanceCalloutClusterTarget();
  }, [advanceCalloutClusterTarget]);
  const shouldRenderIntro =
    !isHudEnabled &&
    !overlayDebugState.hasCalloutDebugQuery &&
    (overlayDebugState.isIntroDebugMode || !isIntroComplete);

  useEffect(() => {
    const abortController = new AbortController();
    const shouldAbort = (): boolean => abortController.signal.aborted;

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

  const targetSeverityIntensity =
    activeEventAngle !== null
      ? SEVERITY_INTENSITY[activeEventAngle.event.severity]
      : 1;
  const severityIntensityRef = useSeverityIntensityTransition({
    engineRef,
    targetSeverityIntensity,
    divergenceIntensity,
    ringCount: qualityProfile.ringCount,
    divergenceSampleCount: qualityProfile.divergenceSampleCount,
  });

  useEffect(() => {
    if (!isHudEnabled) {
      return undefined;
    }

    const publishDiagnostics = () => {
      setPublishedHudDiagnostics(latestRenderDiagnosticsRef.current);
      setPublishedSeverityIntensity(severityIntensityRef.current);
    };

    publishDiagnostics();
    const intervalHandle = globalThis.setInterval(
      publishDiagnostics,
      HUD_PUBLISH_INTERVAL_MS
    );

    return () => {
      globalThis.clearInterval(intervalHandle);
    };
  }, [isHudEnabled, severityIntensityRef]);

  useEffect(() => {
    const instrument = instrumentRef.current;
    const canvas = canvasRef.current;

    if (instrument === null || canvas === null) {
      return undefined;
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
              divergenceIntensity={divergenceIntensity}
              eventCount={events.length}
              instrumentSize={instrumentSize}
              networkStatus={networkStatus}
              onDivergenceIntensityChange={setDivergenceIntensity}
              qualityTier={hudQualityTier}
              renderedSeverityIntensity={publishedSeverityIntensity}
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

export { RehoboamScene };
