import { useEffect, useMemo, useState } from "react";

import type { WorldEvent } from "../engine/types";
import { polarToCartesian } from "../layout/polar";

export type InstrumentSize = Readonly<{
  width: number;
  height: number;
}>;

export type CalloutOverlayTarget = Readonly<{
  event: WorldEvent;
  angleRad: number;
  anchorRadius: number;
}>;

export type CalloutOverlayProps = Readonly<{
  instrumentSize: InstrumentSize;
  target: CalloutOverlayTarget | null;
}>;

type CalloutGeometry = Readonly<{
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
  leaderPath: string;
  leaderLength: number;
}>;

const LEADER_LINE_DRAW_MS = 200;

const clampNumber = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const readNowMs = (): number => {
  if (typeof performance.now === "function") {
    return performance.now();
  }

  return Date.now();
};

const formatCalloutTime = (timestampMs: number): string => {
  const isoTime = new Date(timestampMs).toISOString().slice(11, 19);

  return isoTime.replace(/:/gu, ".");
};

const getCalloutLocationText = (event: WorldEvent): string => {
  if (event.location !== undefined) {
    return event.location.label.toUpperCase();
  }

  return event.category.replace(/[_-]/gu, " ").toUpperCase();
};

const getLeaderLength = (
  anchorX: number,
  anchorY: number,
  elbowX: number,
  elbowY: number,
  lineEndX: number,
  lineEndY: number
): number => {
  const segmentOneLength = Math.hypot(anchorX - elbowX, anchorY - elbowY);
  const segmentTwoLength = Math.hypot(elbowX - lineEndX, elbowY - lineEndY);

  return segmentOneLength + segmentTwoLength;
};

const getCalloutGeometry = (
  instrumentSize: InstrumentSize,
  target: CalloutOverlayTarget
): CalloutGeometry | null => {
  if (instrumentSize.width <= 0 || instrumentSize.height <= 0) {
    return null;
  }

  const center = {
    x: instrumentSize.width / 2,
    y: instrumentSize.height / 2,
  };
  const anchor = polarToCartesian(
    {
      radius: target.anchorRadius,
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
  const isRightSide = anchor.x >= center.x;
  const horizontalGap = instrumentSize.width * 0.08;
  const idealLabelX = isRightSide
    ? anchor.x + horizontalGap
    : anchor.x - labelWidth - horizontalGap;
  const labelX = clampNumber(
    idealLabelX,
    margin,
    instrumentSize.width - labelWidth - margin
  );
  const idealLabelY = anchor.y - labelHeight - instrumentSize.height * 0.06;
  const labelY = clampNumber(idealLabelY, margin, instrumentSize.height * 0.48);
  const lineEndX = isRightSide ? labelX : labelX + labelWidth;
  const lineEndY = labelY + labelHeight * 0.84;
  const elbowDeltaX = Math.max(24, instrumentSize.width * 0.045);
  const elbowX = anchor.x + (isRightSide ? elbowDeltaX : -elbowDeltaX);
  const elbowY = anchor.y - Math.max(28, instrumentSize.height * 0.058);
  const leaderPath = `M ${anchor.x} ${anchor.y} L ${elbowX} ${elbowY} L ${lineEndX} ${lineEndY}`;
  const leaderLength = getLeaderLength(
    anchor.x,
    anchor.y,
    elbowX,
    elbowY,
    lineEndX,
    lineEndY
  );

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
    leaderPath,
    leaderLength,
  };
};

export const CalloutOverlay = ({
  instrumentSize,
  target,
}: CalloutOverlayProps) => {
  const [leaderProgress, setLeaderProgress] = useState(0);
  const geometry = useMemo(() => {
    if (target === null) {
      return null;
    }

    return getCalloutGeometry(instrumentSize, target);
  }, [instrumentSize, target]);

  useEffect(() => {
    setLeaderProgress(0);

    if (target === null) {
      return;
    }

    const startedAtMs = readNowMs();
    let rafHandle = 0;

    const tick = () => {
      const nowMs = readNowMs();
      const elapsedMs = nowMs - startedAtMs;
      const nextProgress = clampNumber(elapsedMs / LEADER_LINE_DRAW_MS, 0, 1);

      setLeaderProgress(nextProgress);

      if (nextProgress < 1) {
        rafHandle = window.requestAnimationFrame(tick);
      }
    };

    rafHandle = window.requestAnimationFrame(tick);

    return () => {
      if (rafHandle !== 0) {
        window.cancelAnimationFrame(rafHandle);
      }
    };
  }, [target]);

  if (geometry === null || target === null) {
    return null;
  }

  const lineProgress = clampNumber(leaderProgress, 0, 1);
  const textProgress = clampNumber((lineProgress - 0.35) / 0.65, 0, 1);

  return (
    <>
      <svg
        aria-hidden
        className="rehoboam-scene__overlay"
        viewBox={`0 0 ${instrumentSize.width} ${instrumentSize.height}`}
      >
        <path
          className="rehoboam-scene__callout-line"
          d={geometry.leaderPath}
          style={{
            strokeDasharray: `${geometry.leaderLength}`,
            strokeDashoffset: `${geometry.leaderLength * (1 - lineProgress)}`,
          }}
        />
        <circle
          className="rehoboam-scene__callout-node"
          cx={geometry.anchorX}
          cy={geometry.anchorY}
          r={5}
          style={{
            opacity: 0.4 + textProgress * 0.6,
          }}
        />
        <circle
          className="rehoboam-scene__callout-node rehoboam-scene__callout-node--inner"
          cx={geometry.anchorX}
          cy={geometry.anchorY}
          r={2}
          style={{
            opacity: 0.35 + textProgress * 0.65,
          }}
        />
      </svg>
      <div
        className="rehoboam-scene__callout"
        style={{
          left: geometry.labelX,
          top: geometry.labelY,
          width: geometry.labelWidth,
          opacity: textProgress,
          transform: `translate3d(0, ${(1 - textProgress) * 7}px, 0)`,
        }}
      >
        <p className="rehoboam-scene__callout-time">
          {formatCalloutTime(geometry.event.timestampMs)}
        </p>
        <p className="rehoboam-scene__callout-title">
          DIVERGENCE : {getCalloutLocationText(geometry.event)}
        </p>
        <p className="rehoboam-scene__callout-subtitle">
          {geometry.event.title.toUpperCase()}
        </p>
        <p className="rehoboam-scene__callout-meta">
          {geometry.event.severity.toUpperCase()} /{" "}
          {geometry.event.category.toUpperCase()}
        </p>
      </div>
    </>
  );
};
