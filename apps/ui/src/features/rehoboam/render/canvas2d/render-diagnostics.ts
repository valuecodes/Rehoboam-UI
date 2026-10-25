import type {
  RehoboamRenderDiagnostics,
  RehoboamRendererFrame,
  RehoboamTheme,
} from "~/features/rehoboam/engine/types";

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

type RenderDiagnosticsCollector = Readonly<{
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

const getElapsedDurationMs = (startedAtMs: number): number =>
  Math.max(0, getNowMs() - startedAtMs);

const measureWithoutDiagnostics: RenderDiagnosticsCollector["measure"] = (
  _,
  draw
) => draw();
const finishWithoutDiagnostics: RenderDiagnosticsCollector["finish"] = () =>
  undefined;

const createNoopRenderDiagnosticsCollector =
  (): RenderDiagnosticsCollector => ({
    finish: finishWithoutDiagnostics,
    measure: measureWithoutDiagnostics,
  });

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
    const finish: RenderDiagnosticsCollector["finish"] = (input) => ({
      fps: input.frame.deltaMs > 0 ? 1000 / input.frame.deltaMs : 0,
      frameMs: getElapsedDurationMs(frameStartedAtMs),
      passMs: passDurations,
      activePulseCount: input.activePulseCount,
      activeClusterCount: input.activeClusterCount,
      ringCount: input.theme.ringCount,
      divergenceSampleCount: input.theme.divergenceSampleCount,
    });

    return {
      finish,
      measure,
    };
  };

const createRenderDiagnosticsCollector = (
  enabled: boolean
): RenderDiagnosticsCollector =>
  enabled
    ? createActiveRenderDiagnosticsCollector()
    : createNoopRenderDiagnosticsCollector();

export { createRenderDiagnosticsCollector };
