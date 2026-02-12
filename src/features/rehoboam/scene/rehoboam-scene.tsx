import { useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import { refreshEventsFromSource } from "../data/bootstrap";
import { loadPersistedEvents } from "../data/persistence";
import { createMockEventSource } from "../data/source";
import { DEFAULT_DPR_CAP, DEFAULT_THEME } from "../engine/defaults";
import {
  applyHoverDwellTick,
  clearInteractionSelection,
  createInitialInteractionState,
  DEFAULT_HOVER_DWELL_MS,
  pickMarkerHitTarget,
  updateInteractionForClick,
  updateInteractionForPointerDown,
  updateInteractionForPointerLeave,
  updateInteractionForPointerMove,
  updateInteractionForPointerUp,
} from "../engine/input";
import type { MarkerHitTarget } from "../engine/input";
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
import type { CartesianCoordinate } from "../layout/polar";
import { polarToCartesian } from "../layout/polar";
import { CalloutOverlay } from "../overlay/callout-overlay";
import type {
  CalloutOverlayTarget,
  InstrumentSize,
} from "../overlay/callout-overlay";
import { EventListPanel } from "../overlay/event-list-panel";
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

const readNowMs = (): number => {
  if (typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
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

const getClockwiseEventCycleIds = (
  eventAngles: readonly ComputedEventAngle[]
): readonly string[] => {
  return [...eventAngles]
    .sort((left, right) => {
      if (left.angleRad !== right.angleRad) {
        return left.angleRad - right.angleRad;
      }

      return left.event.id.localeCompare(right.event.id);
    })
    .map((eventAngle) => eventAngle.event.id);
};

const resolveActiveEventId = (
  eventAngles: readonly ComputedEventAngle[],
  selectedEventId: string | null,
  hoveredEventId: string | null,
  autoEventId: string | null
): string | null => {
  for (const candidateEventId of [selectedEventId, hoveredEventId, autoEventId]) {
    if (candidateEventId === null) {
      continue;
    }

    if (findEventAngleByEventId(eventAngles, candidateEventId) !== null) {
      return candidateEventId;
    }
  }

  return [...eventAngles].sort(compareEventAnglesByPriority)[0]?.event.id ?? null;
};

const toMarkerHitTargets = (
  eventAngles: readonly ComputedEventAngle[],
  instrumentSize: InstrumentSize
): readonly MarkerHitTarget[] => {
  if (instrumentSize.width <= 0 || instrumentSize.height <= 0) {
    return [];
  }

  const center = {
    x: instrumentSize.width / 2,
    y: instrumentSize.height / 2,
  };
  const anchorRadius = getMarkerAnchorRadius(instrumentSize);
  const hitRadiusPx = Math.max(
    24,
    Math.min(instrumentSize.width, instrumentSize.height) * 0.03
  );

  return eventAngles.map((eventAngle) => {
    const position = polarToCartesian(
      {
        radius: anchorRadius,
        angleRad: eventAngle.angleRad,
      },
      center
    );

    return {
      eventId: eventAngle.event.id,
      eventIds: eventAngle.eventIds,
      position,
      hitRadiusPx,
    };
  });
};

const getPointerPosition = (
  event: ReactPointerEvent<HTMLElement>
): CartesianCoordinate => {
  const bounds = event.currentTarget.getBoundingClientRect();

  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
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
  const [interaction, setInteraction] = useState<InteractionState>(() => {
    return createInitialInteractionState();
  });
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
  const clockwiseEventCycleIds = useMemo(() => {
    return getClockwiseEventCycleIds(eventAngles);
  }, [eventAngles]);
  const markerHitTargets = useMemo(() => {
    return toMarkerHitTargets(eventAngles, instrumentSize);
  }, [eventAngles, instrumentSize]);
  const activeEventId = useMemo(() => {
    return resolveActiveEventId(
      eventAngles,
      interaction.selectedEventId,
      interaction.hoveredEventId,
      autoEventId
    );
  }, [
    autoEventId,
    eventAngles,
    interaction.hoveredEventId,
    interaction.selectedEventId,
  ]);
  const activeEventAngle = useMemo(() => {
    return resolveActiveEventAngle(eventAngles, activeEventId);
  }, [activeEventId, eventAngles]);
  const interactionForRender = useMemo<InteractionState>(() => {
    if (activeEventId === null) {
      return interaction;
    }

    if (
      interaction.selectedEventId !== null ||
      interaction.hoveredEventId !== null
    ) {
      return interaction;
    }

    return {
      ...interaction,
      hoverCandidateEventId: null,
      hoveredEventId: activeEventId,
      hoverStartedAtMs: null,
    };
  }, [activeEventId, interaction]);
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
    if (clockwiseEventCycleIds.length === 0) {
      setAutoEventId(null);

      return;
    }

    if (
      interaction.selectedEventId !== null ||
      interaction.hoveredEventId !== null ||
      interaction.hoverCandidateEventId !== null ||
      interaction.isPointerDown
    ) {
      return;
    }

    if (
      autoEventId === null ||
      !clockwiseEventCycleIds.includes(autoEventId)
    ) {
      setAutoEventId(clockwiseEventCycleIds[0]);

      return;
    }

    const currentIndex = clockwiseEventCycleIds.indexOf(autoEventId);
    const timeoutHandle = window.setTimeout(() => {
      const nextIndex = (currentIndex + 1) % clockwiseEventCycleIds.length;
      setAutoEventId(clockwiseEventCycleIds[nextIndex]);
    }, AUTO_EVENT_CYCLE_MS);

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [
    autoEventId,
    clockwiseEventCycleIds,
    interaction.hoverCandidateEventId,
    interaction.hoveredEventId,
    interaction.isPointerDown,
    interaction.selectedEventId,
  ]);

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

    engine.setInteraction(interactionForRender);
  }, [interactionForRender]);

  useEffect(() => {
    const engine = engineRef.current;

    if (engine === null) {
      return;
    }

    engine.setEvents(events);
  }, [events]);

  useEffect(() => {
    if (
      interaction.hoverCandidateEventId === null ||
      interaction.hoverStartedAtMs === null ||
      interaction.hoveredEventId !== null ||
      interaction.selectedEventId !== null
    ) {
      return;
    }

    const elapsedMs = readNowMs() - interaction.hoverStartedAtMs;
    const remainingMs = Math.max(0, DEFAULT_HOVER_DWELL_MS - elapsedMs);

    const timeoutHandle = window.setTimeout(() => {
      setInteraction((previousInteraction) => {
        return applyHoverDwellTick({
          interaction: previousInteraction,
          timeMs: readNowMs(),
          hoverDwellMs: DEFAULT_HOVER_DWELL_MS,
        });
      });
    }, remainingMs);

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [interaction]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary) {
      return;
    }

    const pointerPosition = getPointerPosition(event);
    const markerTarget = pickMarkerHitTarget(pointerPosition, markerHitTargets);

    setInteraction((previousInteraction) => {
      return updateInteractionForPointerMove({
        interaction: previousInteraction,
        pointer: {
          position: pointerPosition,
          isPrimary: event.isPrimary,
        },
        markerEventId: markerTarget?.eventId ?? null,
        timeMs: readNowMs(),
        hoverDwellMs: DEFAULT_HOVER_DWELL_MS,
      });
    });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    const pointerPosition = getPointerPosition(event);

    setInteraction((previousInteraction) => {
      return updateInteractionForPointerDown({
        interaction: previousInteraction,
        pointer: {
          position: pointerPosition,
          isPrimary: event.isPrimary,
        },
      });
    });
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!event.isPrimary) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const pointerPosition = getPointerPosition(event);
    const markerTarget = pickMarkerHitTarget(pointerPosition, markerHitTargets);

    setInteraction((previousInteraction) => {
      const interactionAfterPointerUp = updateInteractionForPointerUp({
        interaction: previousInteraction,
        pointer: {
          position: pointerPosition,
          isPrimary: event.isPrimary,
        },
      });

      return updateInteractionForClick({
        interaction: interactionAfterPointerUp,
        markerEventId: markerTarget?.eventId ?? null,
      });
    });
  };

  const handlePointerLeave = () => {
    setInteraction((previousInteraction) => {
      return updateInteractionForPointerLeave(previousInteraction);
    });
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape") {
      return;
    }

    setInteraction((previousInteraction) => {
      return clearInteractionSelection(previousInteraction);
    });
  };

  const handlePanelSelection = (eventId: string) => {
    setInteraction((previousInteraction) => {
      return {
        ...previousInteraction,
        selectedEventId: eventId,
        hoverCandidateEventId: null,
        hoveredEventId: null,
        hoverStartedAtMs: null,
      };
    });
    setAutoEventId(eventId);
  };

  const handlePanelSelectionClear = () => {
    setInteraction((previousInteraction) => {
      return clearInteractionSelection(previousInteraction);
    });
  };

  return (
    <main className="rehoboam-scene">
      <div className="rehoboam-scene__layout">
        <section
          aria-label="Rehoboam V2 scene container"
          className="rehoboam-scene__instrument"
          onKeyDown={handleKeyDown}
          onPointerDown={handlePointerDown}
          onPointerLeave={handlePointerLeave}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          ref={instrumentRef}
          tabIndex={0}
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
        <EventListPanel
          activeEventId={activeEventId}
          eventAngles={eventAngles}
          onClearSelection={handlePanelSelectionClear}
          onSelectEvent={handlePanelSelection}
        />
      </div>
    </main>
  );
};
