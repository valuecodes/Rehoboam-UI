import { useEffect, useRef } from "react";
import type { RefObject } from "react";

import { DEFAULT_THEME } from "~/features/rehoboam/engine/defaults";
import type { RehoboamEngine } from "~/features/rehoboam/engine/types";

type SeverityIntensityTransitionOptions = Readonly<{
  engineRef: RefObject<RehoboamEngine | null>;
  targetSeverityIntensity: number;
  divergenceIntensity: number;
  ringCount: number;
  divergenceSampleCount: number;
}>;

const TRANSITION_MS = 1500;

const smoothstep = (t: number) => t * t * (3 - 2 * t);

// Eases the engine's divergence intensity towards the active event's severity
// and re-applies the theme on every frame of the transition. Returns the ref
// holding the currently rendered severity intensity.
const useSeverityIntensityTransition = ({
  engineRef,
  targetSeverityIntensity,
  divergenceIntensity,
  ringCount,
  divergenceSampleCount,
}: SeverityIntensityTransitionOptions): RefObject<number> => {
  const severityIntensityRef = useRef(targetSeverityIntensity);

  useEffect(() => {
    const engine = engineRef.current;

    if (engine === null) {
      return undefined;
    }

    const startValue = severityIntensityRef.current;
    const startTime = performance.now();
    let rafId: number;

    const animate = () => {
      rafId = requestAnimationFrame((now) => {
        const progress = Math.min((now - startTime) / TRANSITION_MS, 1);
        const eased = smoothstep(progress);
        const next =
          startValue + (targetSeverityIntensity - startValue) * eased;

        severityIntensityRef.current = next;

        engine.setTheme({
          ...DEFAULT_THEME,
          ringCount,
          divergenceSampleCount,
          divergenceIntensity: (divergenceIntensity / 50) * next,
        });

        if (progress < 1) {
          animate();
        }
      });
    };

    animate();

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [
    engineRef,
    targetSeverityIntensity,
    divergenceIntensity,
    divergenceSampleCount,
    ringCount,
  ]);

  return severityIntensityRef;
};

export { useSeverityIntensityTransition };
