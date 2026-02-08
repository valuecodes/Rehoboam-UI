import { useEffect, useMemo, useRef, useState } from "react";

import { getMockFixtureEvents } from "../data/source";
import { DEFAULT_DPR_CAP } from "../engine/defaults";
import { createRehoboamEngine } from "../engine/rehoboam-engine";
import type { WorldEvent, WorldEventSeverity } from "../engine/types";
import { computeAngles } from "../layout/compute-angles";
import { polarToCartesian } from "../layout/polar";

import "./rehoboam-scene.css";

type InstrumentSize = Readonly<{
  width: number;
  height: number;
}>;

type PrimaryCallout = Readonly<{
  event: WorldEvent;
  anchorX: number;
  anchorY: number;
  elbowX: number;
  elbowY: number;
  lineEndX: number;
  lineEndY: number;
  labelX: number;
  labelY: number;
  labelWidth: number;
}>;

const LEADING_TIME_OFFSET_MS = 45 * 60 * 1000;

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

const formatCalloutTime = (timestampMs: number): string => {
  const isoTime = new Date(timestampMs).toISOString().slice(11, 19);

  return isoTime.replace(/:/gu, ".");
};

const clampNumber = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const getCalloutLocationText = (event: WorldEvent): string => {
  if (event.location !== undefined) {
    return event.location.label.toUpperCase();
  }

  return event.category.replace(/[_-]/gu, " ").toUpperCase();
};

const getPrimaryCallout = (
  events: readonly WorldEvent[],
  instrumentSize: InstrumentSize
): PrimaryCallout | null => {
  if (
    events.length === 0 ||
    instrumentSize.width <= 0 ||
    instrumentSize.height <= 0
  ) {
    return null;
  }

  const latestTimestampMs = events.reduce((latest, event) => {
    return Math.max(latest, event.timestampMs);
  }, 0);
  const mapped = computeAngles(events, {
    nowMs: latestTimestampMs + LEADING_TIME_OFFSET_MS,
    maxVisibleCount: 48,
  });

  if (mapped.length === 0) {
    return null;
  }

  const target = [...mapped].sort((left, right) => {
    const severityDelta =
      SEVERITY_RANK[right.event.severity] - SEVERITY_RANK[left.event.severity];

    if (severityDelta !== 0) {
      return severityDelta;
    }

    if (left.event.timestampMs !== right.event.timestampMs) {
      return right.event.timestampMs - left.event.timestampMs;
    }

    return left.event.id.localeCompare(right.event.id);
  })[0];
  const center = {
    x: instrumentSize.width / 2,
    y: instrumentSize.height / 2,
  };
  const outerRadius =
    Math.min(instrumentSize.width, instrumentSize.height) * 0.46;
  const anchor = polarToCartesian(
    {
      radius: outerRadius * 0.87,
      angleRad: target.angleRad,
    },
    center
  );
  const margin = Math.max(12, instrumentSize.width * 0.02);
  const labelWidth = clampNumber(
    instrumentSize.width * 0.42,
    220,
    instrumentSize.width * 0.54
  );
  const labelHeight = clampNumber(
    instrumentSize.height * 0.12,
    58,
    instrumentSize.height * 0.18
  );
  const idealLabelX = anchor.x - labelWidth - instrumentSize.width * 0.08;
  const labelX = clampNumber(
    idealLabelX,
    margin,
    instrumentSize.width - labelWidth - margin
  );
  const idealLabelY = anchor.y - labelHeight - instrumentSize.height * 0.06;
  const labelY = clampNumber(idealLabelY, margin, instrumentSize.height * 0.48);
  const lineEndX = labelX + labelWidth;
  const lineEndY = labelY + labelHeight * 0.84;
  const elbowX = anchor.x - Math.max(24, instrumentSize.width * 0.045);
  const elbowY = anchor.y - Math.max(28, instrumentSize.height * 0.058);

  return {
    event: target.event,
    anchorX: anchor.x,
    anchorY: anchor.y,
    elbowX,
    elbowY,
    lineEndX,
    lineEndY,
    labelX,
    labelY,
    labelWidth,
  };
};

export const RehoboamScene = () => {
  const instrumentRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [instrumentSize, setInstrumentSize] = useState<InstrumentSize>({
    width: 0,
    height: 0,
  });
  const events = useMemo(() => getMockFixtureEvents(), []);
  const primaryCallout = useMemo(() => {
    return getPrimaryCallout(events, instrumentSize);
  }, [events, instrumentSize]);

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

    const resizeToBounds = (width: number, height: number) => {
      setInstrumentSize({ width, height });
      engine.resize({
        width,
        height,
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
    engine.setEvents(events);
    engine.start();

    return () => {
      observer.disconnect();
      engine.destroy();
    };
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
        {primaryCallout !== null && (
          <>
            <svg
              aria-hidden
              className="rehoboam-scene__overlay"
              viewBox={`0 0 ${instrumentSize.width} ${instrumentSize.height}`}
            >
              <line
                className="rehoboam-scene__callout-line"
                x1={primaryCallout.anchorX}
                x2={primaryCallout.elbowX}
                y1={primaryCallout.anchorY}
                y2={primaryCallout.elbowY}
              />
              <line
                className="rehoboam-scene__callout-line"
                x1={primaryCallout.elbowX}
                x2={primaryCallout.lineEndX}
                y1={primaryCallout.elbowY}
                y2={primaryCallout.lineEndY}
              />
              <circle
                className="rehoboam-scene__callout-node"
                cx={primaryCallout.anchorX}
                cy={primaryCallout.anchorY}
                r={5}
              />
              <circle
                className="rehoboam-scene__callout-node rehoboam-scene__callout-node--inner"
                cx={primaryCallout.anchorX}
                cy={primaryCallout.anchorY}
                r={2}
              />
            </svg>
            <div
              className="rehoboam-scene__callout"
              style={{
                left: primaryCallout.labelX,
                top: primaryCallout.labelY,
                width: primaryCallout.labelWidth,
              }}
            >
              <p className="rehoboam-scene__callout-time">
                {formatCalloutTime(primaryCallout.event.timestampMs)}
              </p>
              <p className="rehoboam-scene__callout-title">
                DIVERGENCE : {getCalloutLocationText(primaryCallout.event)}
              </p>
              <p className="rehoboam-scene__callout-subtitle">
                {primaryCallout.event.title.toUpperCase()}
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
};
