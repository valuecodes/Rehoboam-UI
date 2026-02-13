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

const V1_LINE_DELAY_MS = 1_000;
const V1_LINE_DURATION_MS = 1_000;
const V1_TEXT_DELAY_MS = 2_000;
const V1_AUTO_CLOSE_MS = 5_000;
const V1_CLEAR_CLOSE_MS = 3_200;
const V1_DASH_LENGTH = 1_800;
const V1_TEXT_TRACK_OPEN = -10;
const V1_TEXT_TRACK_CLOSE = 10;
const V1_TEXT_SHIFT_PX = 7;

const clampNumber = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const formatCalloutTime = (timestampMs: number): string => {
  const isoTime = new Date(timestampMs).toISOString().slice(11, 19);

  return isoTime.replace(/:/gu, ".");
};

const getCalloutLocationText = (event: WorldEvent): string => {
  if (event.location !== undefined) {
    return event.location.label;
  }

  return event.category.replace(/[_-]/gu, " ");
};

const getCalloutAddText = (event: WorldEvent): string => {
  if (event.summary !== undefined && event.summary.trim().length > 0) {
    return event.summary;
  }

  return `${event.severity} / ${event.category}`;
};

const toPointList = (points: readonly Point[]): string => {
  return points
    .map((point) => {
      return `${point.x} ${point.y}`;
    })
    .join(",");
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
  const basePanelX =
    prefersSingleSide || !isRightSide ? leftPanelX : rightPanelX;
  const basePanelY = isLowerHalf
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
  const firstFrameX = panelX + (isLeftLayout ? 0 : panelWidth * (2 / 3));
  const firstFrameY = panelY + (isBottomLayout ? 70 : 30);
  const secondFrameX = firstFrameX + (isLeftLayout ? -cornerStep : cornerStep);
  const secondFrameY = firstFrameY;
  const thirdFrameX =
    firstFrameX + (isLeftLayout ? -cornerStep * 2 : cornerStep * 2);
  const thirdFrameY = panelY + (isBottomLayout ? 60 : 40);
  const fourthFrameX = thirdFrameX;
  const fourthFrameY = panelY + (isBottomLayout ? 20 : 80);
  const fifthFrameX = firstFrameX;
  const fifthFrameY = panelY + (isBottomLayout ? 0 : 100);
  const lineEndX = panelX + (isLeftLayout ? panelWidth * 0.5 : panelWidth / 6);
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
  const timeMarginTop = panelY < 300 ? 20 : 0;

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
  ({ instrumentSize, target }: CalloutOverlayProps) => {
    const [renderTarget, setRenderTarget] =
      useState<CalloutOverlayTarget | null>(target);
    const renderTargetRef = useRef<CalloutOverlayTarget | null>(target);
    const [open, setOpen] = useState<"open" | "close">("open");
    const [animationKey, setAnimationKey] = useState(0);
    const targetEventId = target?.event.id ?? null;
    const geometryTarget = target ?? renderTarget;
    const geometry = useMemo(() => {
      if (geometryTarget === null) {
        return null;
      }

      return getCalloutGeometry(instrumentSize, geometryTarget);
    }, [geometryTarget, instrumentSize]);

    useEffect(() => {
      if (target === null) {
        return;
      }

      renderTargetRef.current = target;
    }, [target]);

    useEffect(() => {
      let clearHandle = 0;
      let closeHandle = 0;

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
      }, V1_AUTO_CLOSE_MS);

      return () => {
        if (closeHandle !== 0) {
          window.clearTimeout(closeHandle);
        }
      };
    }, [targetEventId]);

    const [lineSpring] = useSpring(
      {
        reset: true,
        from: {
          dashOffset: open === "open" ? -V1_DASH_LENGTH : 0,
          nodeRadius: 0,
          nodeOpacity: open === "open" ? 0 : 1,
        },
        to: {
          dashOffset: open === "open" ? 0 : V1_DASH_LENGTH,
          nodeRadius: 1.5,
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

    const locationText = getCalloutLocationText(geometry.event);
    const titleSizePx = locationText.length < 30 ? 35 : 20;
    const titleMarginTopPx = locationText.length < 30 ? 0 : 10;
    const messageText = geometry.event.title;
    const addText = getCalloutAddText(geometry.event);

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
              strokeDashoffset: lineSpring.dashOffset,
            }}
          />
          <animated.polyline
            className="rehoboam-scene__callout-frame"
            points={geometry.framePoints}
            style={{
              strokeDasharray: V1_DASH_LENGTH,
              strokeDashoffset: lineSpring.dashOffset,
            }}
          />
          <animated.circle
            className="rehoboam-scene__callout-node"
            cx={geometry.anchorX}
            cy={geometry.anchorY}
            r={lineSpring.nodeRadius}
            style={{
              opacity: lineSpring.nodeOpacity,
            }}
          />
          <animated.circle
            className="rehoboam-scene__callout-node rehoboam-scene__callout-node--inner"
            cx={geometry.anchorX}
            cy={geometry.anchorY}
            r={lineSpring.nodeRadius.to((radius: number) => {
              return Math.max(1, radius * 0.66);
            })}
            style={{
              opacity: lineSpring.nodeOpacity,
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
            opacity: textSpring.textOpacity,
            letterSpacing: textSpring.textTracking.to(
              (value: number) => `${value}px`
            ),
            transform: textSpring.textShiftY.to((shiftY: number) => {
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
            {formatCalloutTime(geometry.event.timestampMs)}
          </p>
          <p
            className="rehoboam-scene__callout-title"
            style={{
              fontSize: `${titleSizePx}px`,
              marginTop: `${titleMarginTopPx}px`,
            }}
          >
            {locationText}
          </p>
          <p className="rehoboam-scene__callout-subtitle">{messageText}</p>
          <p className="rehoboam-scene__callout-meta">{addText}</p>
        </animated.div>
      </>
    );
  }
);
