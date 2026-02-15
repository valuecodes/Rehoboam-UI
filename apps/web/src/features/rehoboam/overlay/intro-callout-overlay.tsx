import { memo, useEffect, useMemo, useRef, useState } from "react";
import { animated, useSpring } from "react-spring";

import { polarToCartesian } from "../layout/polar";
import type { InstrumentSize } from "./callout-overlay";

export type IntroCalloutOverlayProps = Readonly<{
  instrumentSize: InstrumentSize;
  onComplete?: () => void;
  debugMode?: boolean;
}>;

type IntroCalloutGeometry = Readonly<{
  anchorX: number;
  anchorY: number;
  framePoints: string;
  connectorPath: string;
  labelX: number;
  labelY: number;
  labelWidth: number;
}>;

type Point = Readonly<{
  x: number;
  y: number;
}>;

const INTRO_LINE_DELAY_MS = 450;
const INTRO_LINE_DURATION_MS = 900;
const INTRO_TEXT_DELAY_MS = 1_150;
const INTRO_AUTO_CLOSE_MS = 4_800;
const INTRO_CLEAR_CLOSE_MS = 3_200;
const INTRO_DASH_LENGTH = 1_200;
const INTRO_TEXT_SHIFT_PX = 6;
const INTRO_TEXT_TRACK_OPEN = -8;
const INTRO_TEXT_TRACK_CLOSE = 10;
const INTRO_ENDPOINT_OUTER_RADIUS_PX = 6;
const INTRO_ENDPOINT_INNER_RADIUS_PX = 2.25;
const INTRO_CORNER_STEP_PX = 10;
const INTRO_LINE_LENGTH_RATIO = 0.5;
const INTRO_FIRST_FRAME_OFFSET_PX = 83;
const INTRO_THIRD_FRAME_OFFSET_PX = 68;
const INTRO_FOURTH_FRAME_OFFSET_PX = 48;
const INTRO_FIFTH_FRAME_OFFSET_PX = 36;
const INTRO_ANCHOR_ANGLE_RAD = 0.67;
const INTRO_ANCHOR_RADIUS_RATIO = 0.84;
const INTRO_LABEL_OFFSET_X_PX = -34;
const INTRO_LABEL_OFFSET_Y_PX = -25;

const clampNumber = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

const toPointList = (points: readonly Point[]): string => {
  return points
    .map((point) => {
      return `${point.x} ${point.y}`;
    })
    .join(",");
};

const formatCurrentDate = (): string => {
  const date = new Date();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const year = `${date.getFullYear()}`.slice(-2);

  return `${month}.${day}.${year}`;
};

const getIntroCalloutGeometry = (
  instrumentSize: InstrumentSize
): IntroCalloutGeometry | null => {
  if (instrumentSize.width <= 0 || instrumentSize.height <= 0) {
    return null;
  }

  const centerX = instrumentSize.width / 2;
  const centerY = instrumentSize.height / 2;
  const margin = Math.max(16, instrumentSize.width * 0.03);
  const maxLabelWidth = Math.max(300, instrumentSize.width - margin * 2);
  const labelWidth = clampNumber(520, 280, maxLabelWidth);
  const labelX = clampNumber(
    centerX - labelWidth * 0.45 + INTRO_LABEL_OFFSET_X_PX,
    margin,
    instrumentSize.width - labelWidth - margin
  );
  const labelY = clampNumber(
    centerY - 36 + INTRO_LABEL_OFFSET_Y_PX,
    margin,
    instrumentSize.height - margin - 140
  );
  const firstFrameX = labelX;
  const firstFrameY = labelY + INTRO_FIRST_FRAME_OFFSET_PX;
  const secondFrameX = firstFrameX - INTRO_CORNER_STEP_PX;
  const secondFrameY = firstFrameY;
  const thirdFrameX = firstFrameX - INTRO_CORNER_STEP_PX * 2;
  const thirdFrameY = labelY + INTRO_THIRD_FRAME_OFFSET_PX;
  const fourthFrameX = thirdFrameX;
  const fourthFrameY = labelY + INTRO_FOURTH_FRAME_OFFSET_PX;
  const fifthFrameX = firstFrameX;
  const fifthFrameY = labelY + INTRO_FIFTH_FRAME_OFFSET_PX;
  const lineLength = labelWidth * INTRO_LINE_LENGTH_RATIO;
  const lineEndX = firstFrameX + lineLength;
  const lineEndY = fifthFrameY;
  const framePoints: readonly Point[] = [
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
  const outerRadius =
    Math.min(instrumentSize.width, instrumentSize.height) * 0.46;
  const anchor = polarToCartesian(
    {
      radius: outerRadius * INTRO_ANCHOR_RADIUS_RATIO,
      angleRad: INTRO_ANCHOR_ANGLE_RAD,
    },
    { x: centerX, y: centerY }
  );
  const anchorX = clampNumber(anchor.x, margin, instrumentSize.width - margin);
  const anchorY = clampNumber(anchor.y, margin, instrumentSize.height - margin);

  return {
    anchorX,
    anchorY,
    framePoints: toPointList(framePoints),
    connectorPath: `M ${anchorX} ${anchorY} L ${lineEndX} ${lineEndY}`,
    labelX,
    labelY,
    labelWidth,
  };
};

export const IntroCalloutOverlay = memo(
  ({
    instrumentSize,
    onComplete,
    debugMode = false,
  }: IntroCalloutOverlayProps) => {
    const onCompleteRef = useRef(onComplete);
    const [open, setOpen] = useState<"open" | "close">("open");
    const currentDateText = useMemo(() => {
      return formatCurrentDate();
    }, []);
    const geometry = useMemo(() => {
      return getIntroCalloutGeometry(instrumentSize);
    }, [instrumentSize]);

    useEffect(() => {
      onCompleteRef.current = onComplete;
    }, [onComplete]);

    useEffect(() => {
      if (debugMode) {
        setOpen("open");

        return;
      }

      setOpen("open");
      let completeHandle = 0;
      const closeHandle = window.setTimeout(() => {
        setOpen("close");
        completeHandle = window.setTimeout(() => {
          onCompleteRef.current?.();
        }, INTRO_CLEAR_CLOSE_MS);
      }, INTRO_AUTO_CLOSE_MS);

      return () => {
        window.clearTimeout(closeHandle);

        if (completeHandle !== 0) {
          window.clearTimeout(completeHandle);
        }
      };
    }, [debugMode]);

    const [lineSpring] = useSpring(
      {
        reset: true,
        from: {
          dashOffset: open === "open" ? -INTRO_DASH_LENGTH : 0,
          nodeOpacity: open === "open" ? 0 : 1,
        },
        to: {
          dashOffset: open === "open" ? 0 : INTRO_DASH_LENGTH,
          nodeOpacity: open === "open" ? 1 : 0,
        },
        delay: debugMode ? 0 : INTRO_LINE_DELAY_MS,
        immediate: debugMode,
        config: { duration: INTRO_LINE_DURATION_MS },
      },
      [debugMode, open]
    );
    const [textSpring] = useSpring(
      {
        reset: true,
        from: {
          textOpacity: open === "open" ? 0 : 1,
          textShiftY: open === "open" ? INTRO_TEXT_SHIFT_PX : 0,
          textTracking: open === "open" ? INTRO_TEXT_TRACK_OPEN : 0,
        },
        to: {
          textOpacity: open === "open" ? 1 : 0,
          textShiftY: open === "open" ? 0 : INTRO_TEXT_SHIFT_PX,
          textTracking: open === "open" ? 0 : INTRO_TEXT_TRACK_CLOSE,
        },
        delay: debugMode ? 0 : INTRO_TEXT_DELAY_MS,
        immediate: debugMode,
        config: { mass: 3, tension: 600, friction: 100 },
      },
      [debugMode, open]
    );

    if (geometry === null) {
      return null;
    }

    return (
      <>
        <svg
          aria-hidden
          className="rehoboam-scene__overlay"
          viewBox={`0 0 ${instrumentSize.width} ${instrumentSize.height}`}
        >
          <animated.polyline
            className="rehoboam-scene__callout-frame"
            points={geometry.framePoints}
            style={{
              strokeDasharray: INTRO_DASH_LENGTH,
              strokeDashoffset: lineSpring.dashOffset,
            }}
          />
          <animated.path
            className="rehoboam-scene__callout-line"
            d={geometry.connectorPath}
            style={{
              strokeDasharray: INTRO_DASH_LENGTH,
              strokeDashoffset: lineSpring.dashOffset,
            }}
          />
          <animated.circle
            className="rehoboam-scene__callout-endpoint-ring"
            cx={geometry.anchorX}
            cy={geometry.anchorY}
            r={INTRO_ENDPOINT_OUTER_RADIUS_PX}
            style={{
              opacity: lineSpring.nodeOpacity,
            }}
          />
          <animated.circle
            className="rehoboam-scene__callout-endpoint-dot"
            cx={geometry.anchorX}
            cy={geometry.anchorY}
            r={INTRO_ENDPOINT_INNER_RADIUS_PX}
            style={{
              opacity: lineSpring.nodeOpacity,
            }}
          />
        </svg>
        <animated.div
          className="rehoboam-scene__callout rehoboam-scene__callout--intro"
          style={{
            left: geometry.labelX,
            top: geometry.labelY,
            width: geometry.labelWidth,
            opacity: textSpring.textOpacity,
            transform: textSpring.textShiftY.to((shiftY: number) => {
              return `translate3d(0, ${shiftY}px, 0)`;
            }),
          }}
        >
          <p className="rehoboam-scene__callout-time rehoboam-scene__callout-time--intro">
            {currentDateText}
          </p>
          <p className="rehoboam-scene__callout-title rehoboam-scene__callout-title--intro">
            SYSTEM INITIATED
          </p>
          <p className="rehoboam-scene__callout-subtitle rehoboam-scene__callout-subtitle--intro">
            UNDISCLOSED LOCATION
          </p>
          <p className="rehoboam-scene__callout-boot rehoboam-scene__callout-boot--intro">
            {"'SOLOMON' BUILD 0.06"}
          </p>
        </animated.div>
      </>
    );
  }
);
