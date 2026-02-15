import { memo, useEffect, useMemo, useRef, useState } from "react";
import { animated, useSpring } from "react-spring";

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
  onCycleComplete?: () => void;
  cycleToken?: number;
}>;

type CalloutGeometry = Readonly<{
  event: WorldEvent;
  anchorX: number;
  anchorY: number;
  labelX: number;
  labelY: number;
  labelWidth: number;
  textAlign: "left" | "right";
  connectorPath: string;
  framePoints: string;
  timeMarginTop: number;
}>;

type Point = Readonly<{
  x: number;
  y: number;
}>;

type CalloutDebugLock = "top" | "bottom";
type CalloutDebugSideLock = "left" | "right";

const V1_LINE_DELAY_MS = 1_000;
const V1_LINE_DURATION_MS = 1_000;
const V1_TEXT_DELAY_MS = 2_000;
const V1_AUTO_CLOSE_MS = 5_000;
const V1_CLEAR_CLOSE_MS = 3_200;
const V1_DASH_LENGTH = 1_800;
const V1_TEXT_TRACK_OPEN = -10;
const V1_TEXT_TRACK_CLOSE = 10;
const V1_TEXT_SHIFT_PX = 7;
const CALLOUT_ENDPOINT_OUTER_RADIUS_PX = 6;
const CALLOUT_ENDPOINT_INNER_RADIUS_PX = 2.25;
const TOP_LAYOUT_TIME_MARGIN_PX = 10;
const RIGHT_LAYOUT_FRAME_START_RATIO = 2 / 3;
const TOP_LAYOUT_HEADER_LINE_LENGTH_RATIO = 0.53;
const BOTTOM_LAYOUT_HEADER_LINE_LENGTH_RATIO = 0.53;
const TOP_LAYOUT_FIRST_FRAME_OFFSET_PX = 30;
const BOTTOM_LAYOUT_FIRST_FRAME_OFFSET_PX = 55;
const TOP_LAYOUT_THIRD_FRAME_OFFSET_PX = 40;
const TOP_LAYOUT_FOURTH_FRAME_OFFSET_PX = 60;
const TOP_LAYOUT_FIFTH_FRAME_OFFSET_PX = 75;
const BOTTOM_LAYOUT_THIRD_FRAME_OFFSET_PX = 40;
const BOTTOM_LAYOUT_FOURTH_FRAME_OFFSET_PX = 20;
const BOTTOM_LAYOUT_FIFTH_FRAME_OFFSET_PX = 0;
const CALLOUT_DEBUG_QUERY_KEY = "callout-debug";
const CALLOUT_DEBUG_HALF_QUERY_KEY = "callout-debug-half";
const CALLOUT_DEBUG_SIDE_QUERY_KEY = "callout-debug-side";

const clampNumber = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
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

const toPointList = (points: readonly Point[]): string => {
  return points
    .map((point) => {
      return `${point.x} ${point.y}`;
    })
    .join(",");
};

const isDebugFlagEnabled = (value: string | null): boolean => {
  if (value === null) {
    return false;
  }

  return ["1", "true", "on", "yes"].includes(value);
};

const getCalloutDebugLock = (): CalloutDebugLock | null => {
  const searchParams = new URLSearchParams(window.location.search);
  const calloutDebugValue = searchParams
    .get(CALLOUT_DEBUG_QUERY_KEY)
    ?.trim()
    .toLowerCase();

  if (calloutDebugValue === "top") {
    return "top";
  }

  if (calloutDebugValue === "bottom") {
    return "bottom";
  }

  if (!isDebugFlagEnabled(calloutDebugValue ?? null)) {
    return null;
  }

  const calloutDebugHalfValue = searchParams
    .get(CALLOUT_DEBUG_HALF_QUERY_KEY)
    ?.trim()
    .toLowerCase();

  if (calloutDebugHalfValue === "bottom") {
    return "bottom";
  }

  if (calloutDebugHalfValue === "top") {
    return "top";
  }

  return "top";
};

const getCalloutDebugSideLock = (): CalloutDebugSideLock | null => {
  const searchParams = new URLSearchParams(window.location.search);
  const calloutDebugSideValue = searchParams
    .get(CALLOUT_DEBUG_SIDE_QUERY_KEY)
    ?.trim()
    .toLowerCase();

  if (calloutDebugSideValue === "left") {
    return "left";
  }

  if (calloutDebugSideValue === "right") {
    return "right";
  }

  return null;
};

const getCalloutGeometry = (
  instrumentSize: InstrumentSize,
  target: CalloutOverlayTarget,
  debugLock: CalloutDebugLock | null,
  debugSideLock: CalloutDebugSideLock | null
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
  const maxPanelWidth = Math.max(180, instrumentSize.width - margin * 2);
  const minPanelWidth = Math.min(260, maxPanelWidth);
  const panelWidth = clampNumber(600, minPanelWidth, maxPanelWidth);
  const maxPanelHeight = Math.max(120, instrumentSize.height - margin * 2);
  const minPanelHeight = Math.min(120, maxPanelHeight);
  const panelHeight = clampNumber(200, minPanelHeight, maxPanelHeight);
  const isRightSide = anchor.x >= center.x;
  const isLowerHalf = anchor.y >= center.y;
  const rightPanelX = instrumentSize.width * 0.7;
  const leftPanelX = instrumentSize.width * 0.1;
  const prefersSingleSide = instrumentSize.width < 1_050;
  const lockedToTop = debugLock === "top";
  const lockedToBottom = debugLock === "bottom";
  const lockedToLeft = debugSideLock === "left";
  const hasVerticalDebugLock = lockedToTop || lockedToBottom;
  const basePanelX = hasVerticalDebugLock
    ? lockedToLeft
      ? leftPanelX
      : rightPanelX
    : prefersSingleSide || !isRightSide
      ? leftPanelX
      : rightPanelX;
  const basePanelY = lockedToBottom
    ? instrumentSize.height - panelHeight
    : lockedToTop
      ? Math.max(30, margin)
      : isLowerHalf
        ? instrumentSize.height - panelHeight
        : Math.max(30, margin);
  const panelX = clampNumber(
    basePanelX,
    margin,
    instrumentSize.width - panelWidth - margin
  );
  const panelY = clampNumber(
    basePanelY,
    margin,
    instrumentSize.height - panelHeight - margin
  );
  const isLeftLayout = panelX < center.x;
  const isBottomLayout = panelY > center.y;
  const cornerStep = 10;
  const firstFrameX =
    panelX + (isLeftLayout ? 0 : panelWidth * RIGHT_LAYOUT_FRAME_START_RATIO);
  const firstFrameY =
    panelY +
    (isBottomLayout
      ? BOTTOM_LAYOUT_FIRST_FRAME_OFFSET_PX
      : TOP_LAYOUT_FIRST_FRAME_OFFSET_PX);
  const secondFrameX = firstFrameX + (isLeftLayout ? -cornerStep : cornerStep);
  const secondFrameY = firstFrameY;
  const thirdFrameX =
    firstFrameX + (isLeftLayout ? -cornerStep * 2 : cornerStep * 2);
  const thirdFrameY =
    panelY +
    (isBottomLayout
      ? BOTTOM_LAYOUT_THIRD_FRAME_OFFSET_PX
      : TOP_LAYOUT_THIRD_FRAME_OFFSET_PX);
  const fourthFrameX = thirdFrameX;
  const fourthFrameY =
    panelY +
    (isBottomLayout
      ? BOTTOM_LAYOUT_FOURTH_FRAME_OFFSET_PX
      : TOP_LAYOUT_FOURTH_FRAME_OFFSET_PX);
  const fifthFrameX = firstFrameX;
  const fifthFrameY =
    panelY +
    (isBottomLayout
      ? BOTTOM_LAYOUT_FIFTH_FRAME_OFFSET_PX
      : TOP_LAYOUT_FIFTH_FRAME_OFFSET_PX);
  const lineLengthRatio = isBottomLayout
    ? BOTTOM_LAYOUT_HEADER_LINE_LENGTH_RATIO
    : TOP_LAYOUT_HEADER_LINE_LENGTH_RATIO;
  const lineLength = panelWidth * lineLengthRatio;
  const lineEndX = firstFrameX + (isLeftLayout ? lineLength : -lineLength);
  const lineEndY = fifthFrameY;
  const framePointList: readonly Point[] = [
    {
      x: firstFrameX,
      y: firstFrameY,
    },
    {
      x: secondFrameX,
      y: secondFrameY,
    },
    {
      x: thirdFrameX,
      y: thirdFrameY,
    },
    {
      x: fourthFrameX,
      y: fourthFrameY,
    },
    {
      x: fifthFrameX,
      y: fifthFrameY,
    },
    {
      x: lineEndX,
      y: lineEndY,
    },
  ];
  const textAlign = panelX < center.x ? "left" : "right";
  const labelX = panelX > center.x ? panelX - panelWidth / 3 : panelX;
  const labelY = panelY;
  const timeMarginTop = panelY < 300 ? TOP_LAYOUT_TIME_MARGIN_PX : 0;

  return {
    event: target.event,
    anchorX: anchor.x,
    anchorY: anchor.y,
    labelX: clampNumber(
      labelX,
      margin,
      instrumentSize.width - panelWidth - margin
    ),
    labelY,
    labelWidth: panelWidth,
    textAlign,
    connectorPath: `M ${anchor.x} ${anchor.y} L ${lineEndX} ${lineEndY}`,
    framePoints: toPointList(framePointList),
    timeMarginTop,
  };
};

export const CalloutOverlay = memo(
  ({
    instrumentSize,
    target,
    onCycleComplete,
    cycleToken = 0,
  }: CalloutOverlayProps) => {
    const calloutDebugLock = useMemo(() => {
      return getCalloutDebugLock();
    }, []);
    const isCalloutDebugMode = calloutDebugLock !== null;
    const calloutDebugSideLock = useMemo(() => {
      if (!isCalloutDebugMode) {
        return null;
      }

      return getCalloutDebugSideLock();
    }, [isCalloutDebugMode]);
    const [debugLockedTarget, setDebugLockedTarget] =
      useState<CalloutOverlayTarget | null>(() => {
        if (!isCalloutDebugMode) {
          return null;
        }

        return target;
      });
    const [renderTarget, setRenderTarget] =
      useState<CalloutOverlayTarget | null>(target);
    const renderTargetRef = useRef<CalloutOverlayTarget | null>(target);
    const onCycleCompleteRef = useRef(onCycleComplete);
    const [open, setOpen] = useState<"open" | "close">("open");
    const [animationKey, setAnimationKey] = useState(0);
    const targetEventId = target?.event.id ?? null;
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

    useEffect(() => {
      onCycleCompleteRef.current = onCycleComplete;
    }, [onCycleComplete]);

    useEffect(() => {
      if (!isCalloutDebugMode) {
        if (debugLockedTarget !== null) {
          setDebugLockedTarget(null);
        }

        return;
      }

      if (target === null) {
        return;
      }

      if (debugLockedTarget === null) {
        setDebugLockedTarget(target);
      }
    }, [debugLockedTarget, isCalloutDebugMode, target]);

    useEffect(() => {
      if (isCalloutDebugMode || target === null) {
        return;
      }

      renderTargetRef.current = target;
    }, [isCalloutDebugMode, target]);

    useEffect(() => {
      if (isCalloutDebugMode) {
        setOpen("open");

        return;
      }

      let clearHandle = 0;
      let closeHandle = 0;
      let cycleCompleteHandle = 0;

      if (targetEventId === null) {
        if (renderTargetRef.current === null) {
          return;
        }

        setRenderTarget(renderTargetRef.current);
        setOpen("close");
        clearHandle = window.setTimeout(() => {
          renderTargetRef.current = null;
          setRenderTarget(null);
        }, V1_CLEAR_CLOSE_MS);

        return () => {
          if (clearHandle !== 0) {
            window.clearTimeout(clearHandle);
          }
        };
      }

      setRenderTarget(null);
      setOpen("open");
      setAnimationKey((currentKey) => {
        return currentKey + 1;
      });
      closeHandle = window.setTimeout(() => {
        setOpen("close");
        cycleCompleteHandle = window.setTimeout(() => {
          onCycleCompleteRef.current?.();
        }, V1_CLEAR_CLOSE_MS);
      }, V1_AUTO_CLOSE_MS);

      return () => {
        if (closeHandle !== 0) {
          window.clearTimeout(closeHandle);
        }

        if (cycleCompleteHandle !== 0) {
          window.clearTimeout(cycleCompleteHandle);
        }
      };
    }, [cycleToken, isCalloutDebugMode, targetEventId]);

    const [lineSpring] = useSpring(
      {
        reset: true,
        from: {
          dashOffset: open === "open" ? -V1_DASH_LENGTH : 0,
          nodeOpacity: open === "open" ? 0 : 1,
        },
        to: {
          dashOffset: open === "open" ? 0 : V1_DASH_LENGTH,
          nodeOpacity: open === "open" ? 1 : 0,
        },
        delay: V1_LINE_DELAY_MS,
        config: { duration: V1_LINE_DURATION_MS },
      },
      [animationKey, open]
    );
    const [textSpring] = useSpring(
      {
        reset: true,
        from: {
          textOpacity: open === "open" ? 0 : 1,
          textShiftY: open === "open" ? V1_TEXT_SHIFT_PX : 0,
          textTracking: open === "open" ? V1_TEXT_TRACK_OPEN : 0,
        },
        to: {
          textOpacity: open === "open" ? 1 : 0,
          textShiftY: open === "open" ? 0 : V1_TEXT_SHIFT_PX,
          textTracking: open === "open" ? 0 : V1_TEXT_TRACK_CLOSE,
        },
        delay: V1_TEXT_DELAY_MS,
        config: { mass: 3, tension: 600, friction: 100 },
      },
      [animationKey, open]
    );

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
          <animated.path
            className="rehoboam-scene__callout-line"
            d={geometry.connectorPath}
            style={{
              strokeDasharray: V1_DASH_LENGTH,
              strokeDashoffset: isCalloutDebugMode ? 0 : lineSpring.dashOffset,
            }}
          />
          <animated.polyline
            className="rehoboam-scene__callout-frame"
            points={geometry.framePoints}
            style={{
              strokeDasharray: V1_DASH_LENGTH,
              strokeDashoffset: isCalloutDebugMode ? 0 : lineSpring.dashOffset,
            }}
          />
          <animated.circle
            className="rehoboam-scene__callout-endpoint-ring"
            cx={geometry.anchorX}
            cy={geometry.anchorY}
            r={CALLOUT_ENDPOINT_OUTER_RADIUS_PX}
            style={{
              opacity: isCalloutDebugMode ? 1 : lineSpring.nodeOpacity,
            }}
          />
          <animated.circle
            className="rehoboam-scene__callout-endpoint-dot"
            cx={geometry.anchorX}
            cy={geometry.anchorY}
            r={CALLOUT_ENDPOINT_INNER_RADIUS_PX}
            style={{
              opacity: isCalloutDebugMode ? 1 : lineSpring.nodeOpacity,
            }}
          />
        </svg>
        <animated.div
          className="rehoboam-scene__callout"
          style={{
            left: geometry.labelX,
            top: geometry.labelY,
            width: geometry.labelWidth,
            textAlign: geometry.textAlign,
            opacity: isCalloutDebugMode ? 1 : textSpring.textOpacity,
            transform: isCalloutDebugMode
              ? "translate3d(0, 0, 0)"
              : textSpring.textShiftY.to((shiftY: number) => {
                  return `translate3d(0, ${shiftY}px, 0)`;
                }),
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
            <span className="rehoboam-scene__callout-title-location">
              {locationText}
            </span>
          </p>
          <p className="rehoboam-scene__callout-subtitle">{titleText}</p>
        </animated.div>
      </>
    );
  }
);
