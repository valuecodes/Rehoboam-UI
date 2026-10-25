import { useEffect, useRef, useState } from "react";

import type { CalloutOverlayTarget } from "./callout-geometry";
import type { CalloutOpenState } from "./use-callout-motion";

type CalloutCyclePhase = "idle" | "showing" | "closing";

// The cycle inputs the current phase was derived from. A new object is stored
// on every transition, which (re)starts the phase timers below.
type CalloutCycleSnapshot = Readonly<{
  cycleToken: number;
  targetEventId: string | null;
  phase: CalloutCyclePhase;
}>;

type CalloutCycleOptions = Readonly<{
  target: CalloutOverlayTarget | null;
  cycleToken: number;
  enabled: boolean;
  onCycleComplete?: () => void;
}>;

type CalloutCycle = Readonly<{
  renderTarget: CalloutOverlayTarget | null;
  open: CalloutOpenState;
  animationKey: number;
}>;

const V1_AUTO_CLOSE_MS = 5000;
const V1_CLEAR_CLOSE_MS = 3200;

// Drives the show -> auto-close -> cycle-complete timeline of the event
// callout. A new target (or cycle token) opens it; losing the target keeps the
// last one rendered while it animates closed, then clears it.
const useCalloutCycle = ({
  target,
  cycleToken,
  enabled,
  onCycleComplete,
}: CalloutCycleOptions): CalloutCycle => {
  const targetEventId = target?.event.id ?? null;
  const onCycleCompleteRef = useRef(onCycleComplete);
  const [lastTarget, setLastTarget] = useState(target);
  const [renderTarget, setRenderTarget] = useState<CalloutOverlayTarget | null>(
    null
  );
  const [open, setOpen] = useState<CalloutOpenState>("open");
  const [animationKey, setAnimationKey] = useState(0);
  const [cycle, setCycle] = useState<CalloutCycleSnapshot>(() => ({
    cycleToken,
    targetEventId,
    phase: targetEventId === null ? "idle" : "showing",
  }));

  // Adjust state while rendering when the cycle inputs change (React's
  // "storing information from previous renders" pattern).
  if (enabled) {
    if (target !== null && target !== lastTarget) {
      setLastTarget(target);
    }

    if (
      cycle.cycleToken !== cycleToken ||
      cycle.targetEventId !== targetEventId
    ) {
      if (targetEventId !== null) {
        setRenderTarget(null);
        setOpen("open");
        setAnimationKey((currentKey) => currentKey + 1);
        setCycle({ cycleToken, targetEventId, phase: "showing" });
      } else if (lastTarget === null) {
        setCycle({ cycleToken, targetEventId, phase: "idle" });
      } else {
        setRenderTarget(lastTarget);
        setOpen("close");
        setCycle({ cycleToken, targetEventId, phase: "closing" });
      }
    }
  }

  useEffect(() => {
    onCycleCompleteRef.current = onCycleComplete;
  }, [onCycleComplete]);

  useEffect(() => {
    if (!enabled || cycle.phase === "idle") {
      return undefined;
    }

    if (cycle.phase === "closing") {
      const clearHandle = globalThis.setTimeout(() => {
        setLastTarget(null);
        setRenderTarget(null);
      }, V1_CLEAR_CLOSE_MS);

      return () => {
        globalThis.clearTimeout(clearHandle);
      };
    }

    let cycleCompleteHandle: ReturnType<typeof setTimeout> | undefined;
    const closeHandle = globalThis.setTimeout(() => {
      setOpen("close");
      cycleCompleteHandle = globalThis.setTimeout(() => {
        onCycleCompleteRef.current?.();
      }, V1_CLEAR_CLOSE_MS);
    }, V1_AUTO_CLOSE_MS);

    return () => {
      globalThis.clearTimeout(closeHandle);

      if (cycleCompleteHandle !== undefined) {
        globalThis.clearTimeout(cycleCompleteHandle);
      }
    };
  }, [cycle, enabled]);

  return { renderTarget, open, animationKey };
};

export { useCalloutCycle };
