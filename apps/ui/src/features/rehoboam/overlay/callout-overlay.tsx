import { motion } from "motion/react";
import { memo, useMemo, useState } from "react";

import type { WorldEvent } from "~/features/rehoboam/engine/types";

import { getCalloutDebugLock, getCalloutDebugSideLock } from "./callout-debug";
import { getCalloutGeometry } from "./callout-geometry";
import type { CalloutOverlayTarget, InstrumentSize } from "./callout-geometry";
import { useCalloutCycle } from "./use-callout-cycle";
import { useCalloutMotion } from "./use-callout-motion";
import type { CalloutMotionTiming } from "./use-callout-motion";

type CalloutOverlayProps = Readonly<{
  instrumentSize: InstrumentSize;
  target: CalloutOverlayTarget | null;
  onCycleComplete?: () => void;
  cycleToken?: number;
}>;

const V1_DASH_LENGTH = 1800;
const V1_MOTION_TIMING: CalloutMotionTiming = {
  dashLength: V1_DASH_LENGTH,
  textShiftPx: 7,
  lineDelayMs: 1000,
  lineDurationMs: 1000,
  textDelayMs: 2000,
};

const formatCalloutDate = (timestampMs: number): string => {
  const date = new Date(timestampMs);
  const month = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  const year = `${date.getUTCFullYear()}`.slice(-2);

  return `${month}.${day}.${year}`;
};

const toCityLabel = (locationLabel: string): string => {
  const [city] = locationLabel.split(",");
  const normalizedCity = city.trim();

  if (normalizedCity.length > 0) {
    return normalizedCity;
  }

  return locationLabel.trim();
};

const getCalloutLocationText = (event: WorldEvent): string => {
  if (event.location !== undefined) {
    return toCityLabel(event.location.label);
  }

  return "Unknown location";
};

const CalloutOverlay = memo(
  ({
    instrumentSize,
    target,
    onCycleComplete,
    cycleToken = 0,
  }: CalloutOverlayProps) => {
    const calloutDebugLock = useMemo(() => getCalloutDebugLock(), []);
    const isCalloutDebugMode = calloutDebugLock !== null;
    const calloutDebugSideLock = useMemo(() => {
      if (!isCalloutDebugMode) {
        return null;
      }

      return getCalloutDebugSideLock();
    }, [isCalloutDebugMode]);
    // Debug mode freezes the callout on the first target it receives.
    const [debugLockedTarget, setDebugLockedTarget] =
      useState<CalloutOverlayTarget | null>(() => {
        if (!isCalloutDebugMode) {
          return null;
        }

        return target;
      });

    if (isCalloutDebugMode && debugLockedTarget === null && target !== null) {
      setDebugLockedTarget(target);
    }

    const { renderTarget, open, animationKey } = useCalloutCycle({
      target,
      cycleToken,
      enabled: !isCalloutDebugMode,
      onCycleComplete,
    });
    const geometryTarget = isCalloutDebugMode
      ? debugLockedTarget
      : (target ?? renderTarget);
    const geometry = useMemo(() => {
      if (geometryTarget === null) {
        return null;
      }

      return getCalloutGeometry(
        instrumentSize,
        geometryTarget,
        calloutDebugLock,
        calloutDebugSideLock
      );
    }, [
      calloutDebugLock,
      calloutDebugSideLock,
      geometryTarget,
      instrumentSize,
    ]);
    const { lineDashOffset, lineNodeOpacity, textOpacity, textTransform } =
      useCalloutMotion({
        timing: V1_MOTION_TIMING,
        open,
        frozen: isCalloutDebugMode,
        restartKey: animationKey,
      });

    if (geometry === null || geometryTarget === null) {
      return null;
    }

    const locationText = getCalloutLocationText(geometry.event).toUpperCase();
    const divergenceLabelText = "DIVERGENCE :";
    const titleText = geometry.event.title.toUpperCase();

    return (
      <>
        <svg
          aria-hidden
          className="rehoboam-scene__overlay"
          viewBox={`0 0 ${instrumentSize.width} ${instrumentSize.height}`}
        >
          <motion.path
            className="rehoboam-scene__callout-line"
            d={geometry.connectorPath}
            style={{
              strokeDasharray: V1_DASH_LENGTH,
              strokeDashoffset: isCalloutDebugMode ? 0 : lineDashOffset,
            }}
          />
          <motion.polyline
            className="rehoboam-scene__callout-frame"
            points={geometry.framePoints}
            style={{
              strokeDasharray: V1_DASH_LENGTH,
              strokeDashoffset: isCalloutDebugMode ? 0 : lineDashOffset,
            }}
          />
          <motion.circle
            className="rehoboam-scene__callout-endpoint-ring"
            cx={geometry.anchorX}
            cy={geometry.anchorY}
            r={geometry.endpointOuterRadius}
            style={{
              opacity: isCalloutDebugMode ? 1 : lineNodeOpacity,
            }}
          />
          <motion.circle
            className="rehoboam-scene__callout-endpoint-dot"
            cx={geometry.anchorX}
            cy={geometry.anchorY}
            r={geometry.endpointInnerRadius}
            style={{
              opacity: isCalloutDebugMode ? 1 : lineNodeOpacity,
            }}
          />
        </svg>
        <motion.div
          className="rehoboam-scene__callout"
          style={{
            left: geometry.labelX,
            top: geometry.labelY,
            width: geometry.labelWidth,
            textAlign: geometry.textAlign,
            opacity: isCalloutDebugMode ? 1 : textOpacity,
            transform: isCalloutDebugMode
              ? "translate3d(0, 0, 0)"
              : textTransform,
          }}
        >
          <p
            className="rehoboam-scene__callout-time"
            style={{
              marginTop: geometry.timeMarginTop,
            }}
          >
            {formatCalloutDate(geometry.event.timestampMs)}
          </p>
          <p className="rehoboam-scene__callout-title">
            <span className="rehoboam-scene__callout-title-label">
              {divergenceLabelText}
            </span>
            <span
              className="rehoboam-scene__callout-title-location"
              style={geometry.titleLocationStyle}
            >
              {locationText}
            </span>
          </p>
          <p className="rehoboam-scene__callout-subtitle">{titleText}</p>
        </motion.div>
      </>
    );
  }
);

CalloutOverlay.displayName = "CalloutOverlay";

export { CalloutOverlay };
