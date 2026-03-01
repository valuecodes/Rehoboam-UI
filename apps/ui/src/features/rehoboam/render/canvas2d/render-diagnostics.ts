import type {
  RehoboamRenderDiagnostics,
  RehoboamRendererFrame,
  RehoboamTheme,
} from "../../engine/types";

const EMPTY_PASS_DURATIONS: RehoboamRenderDiagnostics["passMs"] = {
  background: 0,
  rings: 0,
  contour: 0,
  divergence: 0,
  sweep: 0,
};

type RenderPassName = keyof RehoboamRenderDiagnostics["passMs"];

type DiagnosticsCollectorFinishInput = Readonly<{
  activeClusterCount: number;
  activePulseCount: number;
  frame: RehoboamRendererFrame;
  theme: RehoboamTheme;
}>;

export type RenderDiagnosticsCollector = Readonly<{
  finish: (
    input: DiagnosticsCollectorFinishInput
  ) => RehoboamRenderDiagnostics | undefined;
  measure: <T>(passName: RenderPassName, draw: () => T) => T;
}>;

const getNowMs = (): number => {
  if (
    typeof performance !== "undefined" &&
    typeof performance.now === "function"
  ) {
    return performance.now();
  }

  return Date.now();
};

const getElapsedDurationMs = (startedAtMs: number): number => {
  return Math.max(0, getNowMs() - startedAtMs);
};

const createNoopRenderDiagnosticsCollector = (): RenderDiagnosticsCollector => {
  const measure: RenderDiagnosticsCollector["measure"] = (_, draw) => {
    return draw();
  };
  const finish: RenderDiagnosticsCollector["finish"] = () => {
    return undefined;
  };

  return {
    finish,
    measure,
  };
};

const createActiveRenderDiagnosticsCollector =
  (): RenderDiagnosticsCollector => {
    const frameStartedAtMs = getNowMs();
    const passDurations: Record<RenderPassName, number> = {
      ...EMPTY_PASS_DURATIONS,
    };
    const measure: RenderDiagnosticsCollector["measure"] = (passName, draw) => {
      const startedAtMs = getNowMs();
      const result = draw();
      passDurations[passName] = getElapsedDurationMs(startedAtMs);

      return result;
    };
    const finish: RenderDiagnosticsCollector["finish"] = (input) => {
      return {
        fps: input.frame.deltaMs > 0 ? 1000 / input.frame.deltaMs : 0,
        frameMs: getElapsedDurationMs(frameStartedAtMs),
        passMs: passDurations,
        activePulseCount: input.activePulseCount,
        activeClusterCount: input.activeClusterCount,
        ringCount: input.theme.ringCount,
        divergenceSampleCount: input.theme.divergenceSampleCount,
      };
    };

    return {
      finish,
      measure,
    };
  };

export const createRenderDiagnosticsCollector = (
  enabled: boolean
): RenderDiagnosticsCollector => {
  return enabled
    ? createActiveRenderDiagnosticsCollector()
    : createNoopRenderDiagnosticsCollector();
};
