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
