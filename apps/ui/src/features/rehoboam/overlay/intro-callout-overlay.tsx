import {
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
} from "motion/react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { polarToCartesian } from "../layout/polar";
import type { InstrumentSize } from "./callout-overlay";
import { clampNumber, toPointList } from "./utils";
import type { Point } from "./utils";

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

const INTRO_LINE_DELAY_MS = 450;
const INTRO_LINE_DURATION_MS = 900;
const INTRO_TEXT_DELAY_MS = 1_150;
const INTRO_AUTO_CLOSE_MS = 4_800;
const INTRO_CLEAR_CLOSE_MS = 3_200;
const INTRO_DASH_LENGTH = 1_200;
const INTRO_TEXT_SHIFT_PX = 6;
const INTRO_ENDPOINT_OUTER_RADIUS_PX = 6;
const INTRO_ENDPOINT_INNER_RADIUS_PX = 2.25;
const INTRO_CORNER_STEP_PX = 10;
const COMPACT_INTRO_CORNER_STEP_PX = 7;
const INTRO_LINE_LENGTH_RATIO = 0.5;
const INTRO_FIRST_FRAME_OFFSET_PX = 83;
const INTRO_THIRD_FRAME_OFFSET_PX = 68;
const INTRO_FOURTH_FRAME_OFFSET_PX = 48;
const INTRO_FIFTH_FRAME_OFFSET_PX = 36;
const INTRO_ANCHOR_ANGLE_RAD = 0.67;
const INTRO_ANCHOR_RADIUS_RATIO = 0.84;
const INTRO_LABEL_OFFSET_X_PX = -34;
const INTRO_LABEL_OFFSET_Y_PX = -25;
const COMPACT_INTRO_CENTER_SHIFT_X_PX = 24;
const COMPACT_INTRO_CENTER_SHIFT_Y_PX = 8;
const COMPACT_INTRO_RIGHT_INSET_PX = 20;
const COMPACT_INTRO_LABEL_WIDTH_RATIO = 0.78;
const COMPACT_INTRO_FRAME_INSET_X_PX = 10;

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
  const isCompactViewport = instrumentSize.width <= 700;
  const compactScale = isCompactViewport
    ? clampNumber(instrumentSize.width / 700, 0.68, 0.8)
    : 1;
  const margin = Math.max(16, instrumentSize.width * 0.03);
  const rightInset = isCompactViewport ? COMPACT_INTRO_RIGHT_INSET_PX : 0;
  const maxLabelWidth = Math.max(
    240,
    instrumentSize.width - margin * 2 - rightInset
  );
  const labelWidth = clampNumber(
    Math.round(
      520 *
        compactScale *
        (isCompactViewport ? COMPACT_INTRO_LABEL_WIDTH_RATIO : 1)
    ),
    isCompactViewport ? 220 : 280,
    maxLabelWidth
  );
  const labelOffsetX =
    Math.round(INTRO_LABEL_OFFSET_X_PX * compactScale) +
    (isCompactViewport ? COMPACT_INTRO_CENTER_SHIFT_X_PX : 0);
  const labelX = clampNumber(
    centerX - labelWidth * 0.45 + labelOffsetX,
    margin,
    instrumentSize.width - labelWidth - margin - rightInset
  );
  const labelOffsetY =
    Math.round(INTRO_LABEL_OFFSET_Y_PX * compactScale) +
    (isCompactViewport ? COMPACT_INTRO_CENTER_SHIFT_Y_PX : 0);
  const labelY = clampNumber(
    centerY - Math.round(36 * compactScale) + labelOffsetY,
    margin,
    instrumentSize.height - margin - Math.round(140 * compactScale)
  );
  const cornerStep = Math.max(
    5,
    Math.round(
      (isCompactViewport
        ? COMPACT_INTRO_CORNER_STEP_PX
        : INTRO_CORNER_STEP_PX) * compactScale
    )
  );
  const firstFrameX =
    labelX + (isCompactViewport ? COMPACT_INTRO_FRAME_INSET_X_PX : 0);
  const firstFrameY =
    labelY + Math.round(INTRO_FIRST_FRAME_OFFSET_PX * compactScale);
  const secondFrameX = firstFrameX - cornerStep;
  const secondFrameY = firstFrameY;
  const thirdFrameX = firstFrameX - cornerStep * 2;
  const thirdFrameY =
    labelY + Math.round(INTRO_THIRD_FRAME_OFFSET_PX * compactScale);
  const fourthFrameX = thirdFrameX;
  const fourthFrameY =
    labelY + Math.round(INTRO_FOURTH_FRAME_OFFSET_PX * compactScale);
  const fifthFrameX = firstFrameX;
  const fifthFrameY =
    labelY + Math.round(INTRO_FIFTH_FRAME_OFFSET_PX * compactScale);
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

    const lineDashOffset = useMotionValue(0);
    const lineNodeOpacity = useMotionValue(0);
    const textOpacity = useMotionValue(0);
    const textShiftY = useMotionValue(0);
    const textTransform = useMotionTemplate`translate3d(0, ${textShiftY}px, 0)`;

    useEffect(() => {
      if (debugMode) {
        lineDashOffset.set(0);
        lineNodeOpacity.set(1);
        textOpacity.set(1);
        textShiftY.set(0);

        return;
      }

      const isOpening = open === "open";
      lineDashOffset.set(isOpening ? -INTRO_DASH_LENGTH : 0);
      lineNodeOpacity.set(isOpening ? 0 : 1);
      textOpacity.set(isOpening ? 0 : 1);
      textShiftY.set(isOpening ? INTRO_TEXT_SHIFT_PX : 0);

      const lineAnimation = animate(
        lineDashOffset,
        isOpening ? 0 : INTRO_DASH_LENGTH,
        {
          delay: INTRO_LINE_DELAY_MS / 1_000,
          duration: INTRO_LINE_DURATION_MS / 1_000,
          ease: "linear",
        }
      );
      const nodeAnimation = animate(lineNodeOpacity, isOpening ? 1 : 0, {
        delay: INTRO_LINE_DELAY_MS / 1_000,
        duration: INTRO_LINE_DURATION_MS / 1_000,
        ease: "linear",
      });
      const textOpacityAnimation = animate(textOpacity, isOpening ? 1 : 0, {
        delay: INTRO_TEXT_DELAY_MS / 1_000,
        type: "spring",
        mass: 3,
        stiffness: 600,
        damping: 100,
      });
      const textShiftAnimation = animate(
        textShiftY,
        isOpening ? 0 : INTRO_TEXT_SHIFT_PX,
        {
          delay: INTRO_TEXT_DELAY_MS / 1_000,
          type: "spring",
          mass: 3,
          stiffness: 600,
          damping: 100,
        }
      );

      return () => {
        lineAnimation.stop();
        nodeAnimation.stop();
        textOpacityAnimation.stop();
        textShiftAnimation.stop();
      };
    }, [
      debugMode,
      lineDashOffset,
      lineNodeOpacity,
      open,
      textOpacity,
      textShiftY,
    ]);

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
          <motion.polyline
            className="rehoboam-scene__callout-frame"
            points={geometry.framePoints}
            style={{
              strokeDasharray: INTRO_DASH_LENGTH,
              strokeDashoffset: lineDashOffset,
            }}
          />
          <motion.path
            className="rehoboam-scene__callout-line"
            d={geometry.connectorPath}
            style={{
              strokeDasharray: INTRO_DASH_LENGTH,
              strokeDashoffset: lineDashOffset,
            }}
          />
          <motion.circle
            className="rehoboam-scene__callout-endpoint-ring"
            cx={geometry.anchorX}
            cy={geometry.anchorY}
            r={INTRO_ENDPOINT_OUTER_RADIUS_PX}
            style={{
              opacity: lineNodeOpacity,
            }}
          />
          <motion.circle
            className="rehoboam-scene__callout-endpoint-dot"
            cx={geometry.anchorX}
            cy={geometry.anchorY}
            r={INTRO_ENDPOINT_INNER_RADIUS_PX}
            style={{
              opacity: lineNodeOpacity,
            }}
          />
        </svg>
        <motion.div
          className="rehoboam-scene__callout rehoboam-scene__callout--intro"
          style={{
            left: geometry.labelX,
            top: geometry.labelY,
            width: geometry.labelWidth,
            opacity: textOpacity,
            transform: textTransform,
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
        </motion.div>
      </>
    );
  }
);
