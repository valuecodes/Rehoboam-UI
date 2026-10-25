import { animate, useMotionTemplate, useMotionValue } from "motion/react";
import type { MotionValue } from "motion/react";
import { useEffect } from "react";

type CalloutOpenState = "open" | "close";

type CalloutMotionTiming = Readonly<{
  dashLength: number;
  textShiftPx: number;
  lineDelayMs: number;
  lineDurationMs: number;
  textDelayMs: number;
}>;

type CalloutMotionOptions = Readonly<{
  timing: CalloutMotionTiming;
  open: CalloutOpenState;
  // Debug modes pin the callout fully drawn instead of animating it.
  frozen: boolean;
  // Bumped to replay the opening animation for a new callout.
  restartKey?: number;
}>;

type CalloutMotion = Readonly<{
  lineDashOffset: MotionValue<number>;
  lineNodeOpacity: MotionValue<number>;
  textOpacity: MotionValue<number>;
  textTransform: MotionValue<string>;
}>;

const TEXT_SPRING = {
  type: "spring",
  mass: 3,
  stiffness: 600,
  damping: 100,
} as const;

const useCalloutMotion = ({
  timing,
  open,
  frozen,
  restartKey = 0,
}: CalloutMotionOptions): CalloutMotion => {
  const { dashLength, textShiftPx, lineDelayMs, lineDurationMs, textDelayMs } =
    timing;
  const lineDashOffset = useMotionValue(0);
  const lineNodeOpacity = useMotionValue(0);
  const textOpacity = useMotionValue(0);
  const textShiftY = useMotionValue(0);
  const textTransform = useMotionTemplate`translate3d(0, ${textShiftY}px, 0)`;

  useEffect(() => {
    if (frozen) {
      lineDashOffset.set(0);
      lineNodeOpacity.set(1);
      textOpacity.set(1);
      textShiftY.set(0);

      return undefined;
    }

    const isOpening = open === "open";
    lineDashOffset.set(isOpening ? -dashLength : 0);
    lineNodeOpacity.set(isOpening ? 0 : 1);
    textOpacity.set(isOpening ? 0 : 1);
    textShiftY.set(isOpening ? textShiftPx : 0);

    const lineTransition = {
      delay: lineDelayMs / 1000,
      duration: lineDurationMs / 1000,
      ease: "linear",
    } as const;
    const textTransition = {
      delay: textDelayMs / 1000,
      ...TEXT_SPRING,
    };
    const lineAnimation = animate(
      lineDashOffset,
      isOpening ? 0 : dashLength,
      lineTransition
    );
    const nodeAnimation = animate(lineNodeOpacity, isOpening ? 1 : 0, {
      ...lineTransition,
    });
    const textOpacityAnimation = animate(textOpacity, isOpening ? 1 : 0, {
      ...textTransition,
    });
    const textShiftAnimation = animate(
      textShiftY,
      isOpening ? 0 : textShiftPx,
      textTransition
    );

    return () => {
      lineAnimation.stop();
      nodeAnimation.stop();
      textOpacityAnimation.stop();
      textShiftAnimation.stop();
    };
  }, [
    dashLength,
    frozen,
    lineDashOffset,
    lineDelayMs,
    lineDurationMs,
    lineNodeOpacity,
    open,
    restartKey,
    textDelayMs,
    textOpacity,
    textShiftPx,
    textShiftY,
  ]);

  return {
    lineDashOffset,
    lineNodeOpacity,
    textOpacity,
    textTransform,
  };
};

export { useCalloutMotion };
export type { CalloutMotionTiming, CalloutOpenState };
