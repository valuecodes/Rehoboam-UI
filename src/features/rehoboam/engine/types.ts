import type { SeedInput } from "../../../shared/utils/seeded-rng";
import type { CartesianCoordinate } from "../layout/polar";

export type WorldEventSeverity = "low" | "medium" | "high" | "critical";

export type WorldEventCategory = string;

export type WorldEventLocation = Readonly<{
  label: string;
  latitude: number;
  longitude: number;
}>;

export type WorldEvent = Readonly<{
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

export type ViewportState = Readonly<{
  width: number;
  height: number;
  dpr: number;
  dprCap: number;
  pixelWidth: number;
  pixelHeight: number;
  center: CartesianCoordinate;
  outerRadius: number;
}>;

export type CameraState = Readonly<{
  zoom: number;
  minZoom: number;
  maxZoom: number;
  rotationRad: number;
  targetZoom: number;
  targetRotationRad: number;
}>;

export type PointerState = Readonly<{
  position: CartesianCoordinate;
  isPrimary: boolean;
}>;

export type InteractionState = Readonly<{
  pointer: PointerState | null;
  isPointerDown: boolean;
  isDragging: boolean;
  hoveredEventId: string | null;
  selectedEventId: string | null;
  hoverStartedAtMs: number | null;
}>;

export type RehoboamTheme = Readonly<{
  backgroundColor: string;
  backgroundCoreColor: string;
  ringColor: string;
  sweepColor: string;
  ringSeed: SeedInput;
  ringCount: number;
  sweepSpeedDegPerSecond: number;
}>;

export type EngineResizeInput = Readonly<{
  width: number;
  height: number;
  dpr: number;
}>;

export type RehoboamRendererFrame = Readonly<{
  viewport: ViewportState;
  events: readonly WorldEvent[];
  interaction: InteractionState;
  theme: RehoboamTheme;
  elapsedMs: number;
  timeMs: number;
  deltaMs: number;
}>;

export type RehoboamRenderer = Readonly<{
  resize: (viewport: ViewportState) => void;
  setTheme: (theme: RehoboamTheme) => void;
  render: (frame: RehoboamRendererFrame) => void;
  destroy: () => void;
}>;

export type RehoboamRendererFactoryOptions = Readonly<{
  context: CanvasRenderingContext2D;
  viewport: ViewportState;
  theme: RehoboamTheme;
}>;

export type RehoboamRendererFactory = (
  options: RehoboamRendererFactoryOptions
) => RehoboamRenderer;

export type RehoboamEngine = Readonly<{
  start: () => void;
  stop: () => void;
  resize: (input: EngineResizeInput) => void;
  setEvents: (events: readonly WorldEvent[]) => void;
  setInteraction: (interaction: InteractionState) => void;
  setTheme: (theme: RehoboamTheme) => void;
  destroy: () => void;
}>;

export type RehoboamEngineOptions = Readonly<{
  canvas: HTMLCanvasElement;
  dprCap?: number;
  now?: () => number;
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
  rendererFactory?: RehoboamRendererFactory;
}>;
