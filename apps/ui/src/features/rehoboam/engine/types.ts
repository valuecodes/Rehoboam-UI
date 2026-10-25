import type { CartesianCoordinate } from "~/features/rehoboam/layout/polar";
import type { SeedInput } from "~/shared/utils/seeded-rng";

type WorldEventSeverity = "low" | "medium" | "high" | "critical";

type WorldEventCategory = string;

type WorldEventLocation = Readonly<{
  label: string;
  latitude?: number;
  longitude?: number;
}>;

type WorldEvent = Readonly<{
  id: string;
  title: string;
  timestampMs: number;
  severity: WorldEventSeverity;
  category: WorldEventCategory;
  summary?: string;
  location?: WorldEventLocation;
  createdAtMs?: number;
  updatedAtMs?: number;
}>;

type ViewportState = Readonly<{
  width: number;
  height: number;
  dpr: number;
  dprCap: number;
  pixelWidth: number;
  pixelHeight: number;
  center: CartesianCoordinate;
  outerRadius: number;
}>;

type PointerState = Readonly<{
  position: CartesianCoordinate;
  isPrimary: boolean;
}>;

type InteractionState = Readonly<{
  pointer: PointerState | null;
  isPointerDown: boolean;
  isDragging: boolean;
  hoverCandidateEventId: string | null;
  hoveredEventId: string | null;
  selectedEventId: string | null;
  hoverStartedAtMs: number | null;
}>;

type RehoboamTheme = Readonly<{
  backgroundColor: string;
  backgroundCoreColor: string;
  ringColor: string;
  sweepColor: string;
  ringSeed: SeedInput;
  ringCount: number;
  divergenceSampleCount: number;
  sweepSpeedDegPerSecond: number;
  divergenceIntensity: number;
}>;

type EngineResizeInput = Readonly<{
  width: number;
  height: number;
  dpr: number;
}>;

type RehoboamRendererFrame = Readonly<{
  viewport: ViewportState;
  events: readonly WorldEvent[];
  interaction: InteractionState;
  theme: RehoboamTheme;
  elapsedMs: number;
  timeMs: number;
  deltaMs: number;
}>;

type DivergenceCalloutTarget = Readonly<{
  id: string;
  angleRad: number;
  strength: number;
}>;

type RehoboamRenderDiagnostics = Readonly<{
  fps: number;
  frameMs: number;
  passMs: Readonly<{
    background: number;
    rings: number;
    contour: number;
    divergence: number;
    sweep: number;
  }>;
  activePulseCount: number;
  activeClusterCount: number;
  ringCount: number;
  divergenceSampleCount: number;
}>;

type RehoboamRenderSnapshot = Readonly<{
  timeMs: number;
  divergenceCalloutTargets: readonly DivergenceCalloutTarget[];
  diagnostics?: RehoboamRenderDiagnostics;
}>;

type RehoboamRenderer = Readonly<{
  resize: (viewport: ViewportState) => void;
  setTheme: (theme: RehoboamTheme) => void;
  render: (frame: RehoboamRendererFrame) => RehoboamRenderSnapshot;
  destroy: () => void;
}>;

type RehoboamRendererFactoryOptions = Readonly<{
  context: CanvasRenderingContext2D;
  diagnosticsEnabled?: boolean;
  viewport: ViewportState;
  theme: RehoboamTheme;
}>;

type RehoboamRendererFactory = (
  options: RehoboamRendererFactoryOptions
) => RehoboamRenderer;

type RehoboamEngine = Readonly<{
  start: () => void;
  stop: () => void;
  resize: (input: EngineResizeInput) => void;
  setEvents: (events: readonly WorldEvent[]) => void;
  setInteraction: (interaction: InteractionState) => void;
  setTheme: (theme: RehoboamTheme) => void;
  destroy: () => void;
}>;

type RehoboamEngineOptions = Readonly<{
  canvas: HTMLCanvasElement;
  diagnosticsEnabled?: boolean;
  dprCap?: number;
  now?: () => number;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
  rendererFactory?: RehoboamRendererFactory;
  onRenderSnapshot?: (snapshot: RehoboamRenderSnapshot) => void;
}>;

export type {
  DivergenceCalloutTarget,
  EngineResizeInput,
  InteractionState,
  RehoboamEngine,
  RehoboamEngineOptions,
  RehoboamRenderDiagnostics,
  RehoboamRenderer,
  RehoboamRendererFactory,
  RehoboamRendererFactoryOptions,
  RehoboamRendererFrame,
  RehoboamRenderSnapshot,
  RehoboamTheme,
  ViewportState,
  WorldEvent,
  WorldEventLocation,
  WorldEventSeverity,
};
